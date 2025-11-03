import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";

import { supabaseAdmin } from "@/lib/supabaseAdminClient";
import { logApiEndpoint } from "@/lib/analytics";
import { authenticateRequest } from "@/lib/api-auth";
import { callGemini, ensureText, TEXT_MODEL } from "@/lib/gemini";

const DEFAULT_BUCKET = process.env.RECIPE_STORAGE_BUCKET ?? "recipe-images";
const FIREFLY_BASE_URL = "https://image-v5.ff.adobe.io";

type Ingredient = {
  name: string;
  amount: string;
  notes?: string;
};

type Instruction = {
  step: number;
  action: string;
};

type RecipeData = {
  title: string;
  summary?: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  tags?: string[];
};

type FireflyJobResponse = {
  links?: {
    cancel?: {
      href: string;
    };
    result?: {
      href: string;
    };
  };
  jobId?: string;
  status?: string;
};

type FireflyJobStatus = {
  progress?: number;
  outputs?: Array<{
    seed?: number;
    image?: {
      id?: string;
      presignedUrl?: string;
      creativeCloudFileId?: string;
      url?: string;
    };
  }>;
  output?: {
    imageUrl?: string;
  };
  errors?: Array<{
    message: string;
  }>;
  message?: string;
  error_code?: string;
  status?:
    | "pending"
    | "running"
    | "succeeded"
    | "failed"
    | "cancel_pending"
    | "cancelled"
    | "timeout";
  links?: {
    result?: {
      href: string;
    };
    cancel?: {
      href: string;
    };
  };
};

function calculateFileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 12);
}

async function ensureBucket(bucket: string) {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client is not configured");
  }

  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
  if (error) {
    throw new Error(`Failed listing buckets: ${error.message}`);
  }

  const exists = buckets?.some((candidate) => candidate.name === bucket);
  if (exists) return;

  const { error: createError } = await supabaseAdmin.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: "20MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (createError) {
    throw new Error(`Failed creating bucket ${bucket}: ${createError.message}`);
  }
}

function parseIngredients(raw: string): Ingredient[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          name: String(item.name ?? "").trim(),
          amount: String(item.amount ?? "").trim(),
          notes: item.notes ? String(item.notes).trim() : undefined,
        }))
        .filter((item) => item.name.length > 0);
    }
  } catch {
    // fallback - try to parse as string format
  }
  return [];
}

function parseInstructions(raw: string): Instruction[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((step, index) => {
      // Remove leading number if present (e.g., "1. Action" -> "Action")
      const action = step.replace(/^\d+\.\s*/, "").trim();
      return {
        step: index + 1,
        action,
      };
    });
}

async function enhanceImagePrompt(recipe: RecipeData, basePrompt: string) {
  const descriptiveIngredients = recipe.ingredients
    .slice(0, 6)
    .map((item) => item.name)
    .join(", ");
  const stepsPreview = recipe.instructions
    .slice(0, 3)
    .map((instruction) => instruction.action)
    .join(" ");

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "You are a culinary art director crafting vivid food photography prompts.",
              `Current meal: ${recipe.title}.`,
              recipe.summary ? `Flavor summary: ${recipe.summary}.` : "",
              `Key ingredients: ${descriptiveIngredients}.`,
              `Cooking approach: ${stepsPreview}.`,
              "Elevate the provided base image brief so it sounds mouthwatering, specifying plating, garnish, lighting, and camera perspective.",
              "Keep it under 80 words, omit brand names, and do not add people or utensils in hands.",
              `Base prompt: ${basePrompt}`,
              "Return only the enhanced prompt text.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
    },
  };

  const response = await callGemini(TEXT_MODEL, requestBody);
  return ensureText(response, "Image prompt enhancement");
}

async function generateImageWithFirefly(
  prompt: string,
  token: string,
  apiKey: string,
): Promise<Buffer> {
  // Step 1: Submit generation job
  const submitUrl = `${FIREFLY_BASE_URL}/v1/images/generate-async`;
  const submitResponse = await fetch(submitUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      accept: "*/*",
    },
    body: JSON.stringify({
      n: 1,
      prompt: prompt,
      size: {
        width: 2304,
        height: 1792,
      },
      output: {
        storeInputs: true,
      },
      referenceBlobs: [],
      modelSpecificPayload: {},
      modelVersion: "image5",
    }),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(
      `Firefly API submit failed (${submitResponse.status} ${submitResponse.statusText}): ${errorText}`,
    );
  }

  const jobData = (await submitResponse.json()) as FireflyJobResponse;

  // Extract job ID from result URL if links are provided
  let jobId: string | undefined;
  let statusUrl: string | undefined;

  if (jobData.links?.result?.href) {
    // Extract job ID from URL like: https://firefly-eph851254.adobe.io/jobs/result/5c550d58-fa4d-4cba-9580-79ba791ce406
    const urlMatch = jobData.links.result.href.match(/\/jobs\/result\/([^\/]+)/);
    if (urlMatch) {
      jobId = urlMatch[1];
      statusUrl = jobData.links.result.href;
    }
  } else if (jobData.jobId) {
    jobId = jobData.jobId;
    statusUrl = `${FIREFLY_BASE_URL}/v1/status/${jobId}`;
  }

  if (!jobId || !statusUrl) {
    throw new Error("Firefly API did not return a job ID or result URL");
  }

  console.log(`Submitted image generation job: ${jobId}`);
  console.log("Polling for completion...");
  const maxAttempts = 60; // 5 minutes max (5s intervals)
  const pollInterval = 5000; // 5 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const statusResponse = await fetch(statusUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-api-key": apiKey,
        accept: "*/*",
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(
        `Firefly API status check failed (${statusResponse.status} ${statusResponse.statusText}): ${errorText}`,
      );
    }

    const status = (await statusResponse.json()) as FireflyJobStatus;

    // Check for errors
    if (status.errors && status.errors.length > 0) {
      const errorMessage = status.errors[0].message || "Unknown error";
      throw new Error(`Firefly image generation failed: ${errorMessage}`);
    }

    if (status.status === "failed") {
      const errorMessage = status.errors?.[0]?.message || status.message || "Unknown error";
      throw new Error(`Firefly image generation failed: ${errorMessage}`);
    }

    // Check if job is complete - look for presignedUrl in outputs
    if (status.outputs && Array.isArray(status.outputs) && status.outputs.length > 0) {
      const output = status.outputs[0];
      const imageUrl = output.image?.presignedUrl || output.image?.url;

      if (imageUrl) {
        console.log("Image generation completed, downloading...");
        const imageResponse = await fetch(imageUrl);

        if (!imageResponse.ok) {
          throw new Error(`Failed to download Firefly image (${imageResponse.status})`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        return Buffer.from(imageBuffer);
      }
    }

    // Fallback: check for other URL formats
    if (status.output?.imageUrl) {
      const imageUrl = status.output.imageUrl;
      console.log("Image generation completed, downloading...");
      const imageResponse = await fetch(imageUrl);

      if (!imageResponse.ok) {
        throw new Error(`Failed to download Firefly image (${imageResponse.status})`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      return Buffer.from(imageBuffer);
    }

    // Job is still in progress - check progress if available
    const progress = status.progress;
    if (progress !== undefined) {
      if (progress >= 100) {
        console.log(`Progress: ${progress}% - waiting for final image URL...`);
      } else {
        if ((attempt + 1) % 6 === 0) {
          // Log progress every 30 seconds
          console.log(`Progress: ${progress.toFixed(1)}%`);
        }
      }
    } else if (status.status === "succeeded") {
      throw new Error("Job marked as succeeded but no image URL found in response");
    }

    // Continue polling - no image URL found yet
    if (status.status && status.status !== "pending" && status.status !== "running") {
      throw new Error(`Unexpected Firefly job status: ${status.status}`);
    }
  }

  throw new Error("Firefly image generation timed out after maximum polling attempts");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const editToken = process.env.EDIT_TOKEN;
  if (!editToken) {
    console.error(
      "POST /api/recipes/[slug]/generate-image missing EDIT_TOKEN environment variable.",
    );
    return NextResponse.json({ error: "Server is not configured for edits" }, { status: 500 });
  }

  // Try to authenticate to get user info if available
  const auth = await authenticateRequest(request, { requireAuth: false });
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const tokenMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  const providedToken = tokenMatch ? tokenMatch[1].trim() : null;

  if (!providedToken || providedToken !== editToken) {
    logApiEndpoint({
      endpoint: `/api/recipes/${slug}/generate-image`,
      method: "POST",
      statusCode: 401,
      isProtected: true,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Log endpoint usage
  logApiEndpoint({
    endpoint: `/api/recipes/${slug}/generate-image`,
    method: "POST",
    userId: auth.authorized ? auth.userId : undefined,
    userEmail: auth.authorized ? auth.userEmail : undefined,
    isProtected: true,
  });

  if (!supabaseAdmin) {
    console.error("Supabase admin client is not configured.");
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const fireflyToken = process.env.FIREFLY_API_TOKEN;
  if (!fireflyToken) {
    console.error("POST /api/recipes/[slug]/generate-image missing FIREFLY_API_TOKEN.");
    return NextResponse.json(
      { error: "Server is not configured for image generation" },
      { status: 500 },
    );
  }

  // Get Firefly API key from header, fallback to env or default
  const fireflyApiKey =
    request.headers.get("x-firefly-key")?.trim() ||
    process.env.FIREFLY_API_KEY ||
    "clio-playground-web";

  try {
    const { slug } = await params;

    // Load recipe from database
    const { data: recipeData, error: fetchError } = await supabaseAdmin
      .from("recipes")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (fetchError) {
      console.error("Failed to load recipe:", fetchError);
      return NextResponse.json({ error: "Failed to fetch recipe" }, { status: 500 });
    }

    if (!recipeData) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    // Parse recipe data
    const ingredients = parseIngredients(recipeData.ingredients);
    const instructions = parseInstructions(recipeData.instructions);

    if (ingredients.length === 0) {
      return NextResponse.json({ error: "Recipe has no valid ingredients" }, { status: 400 });
    }

    if (instructions.length === 0) {
      return NextResponse.json({ error: "Recipe has no valid instructions" }, { status: 400 });
    }

    const recipe: RecipeData = {
      title: recipeData.name,
      summary: recipeData.description ?? undefined,
      ingredients,
      instructions,
      tags: recipeData.tags ?? [],
    };

    // Build base image prompt (similar to generate endpoint)
    const nonSettingTags = new Set([
      "vegetarian",
      "vegan",
      "spicy",
      "glutenfree",
      "gluten-free",
      "seafood",
      "beef",
      "chicken",
      "pork",
      "lamb",
      "dairy",
      "legumes",
      "tofu",
      "plant-based",
    ]);
    const cuisineTag = recipe.tags?.find((tag) => !nonSettingTags.has(tag.toLowerCase())) ?? "";
    const tableSetting = cuisineTag
      ? `${cuisineTag.toLowerCase()}-inspired table`
      : "rustic dining table";

    const baseImagePrompt = [
      `Vibrant close-up of ${recipe.title}, plated to showcase vivid textures and color.`,
      recipe.summary ? `Incorporate visual cues from this description: ${recipe.summary}.` : "",
      `Scene: ${tableSetting} with soft natural daylight, eye-level perspective, and shallow depth of field.`,
      "Capture fresh garnish, inviting lighting, and a sense of homemade comfort with no visible steam or vapor. No people or branded props.",
    ]
      .filter(Boolean)
      .join(" ");

    console.log(`Generating image for: ${recipe.title}`);
    console.log(`Base prompt: ${baseImagePrompt.substring(0, 100)}...`);

    // Enrich prompt using Gemini
    const enhancedPrompt = await enhanceImagePrompt(recipe, baseImagePrompt);
    console.log(`Enhanced prompt: ${enhancedPrompt.substring(0, 100)}...`);

    // Generate image using Firefly
    const imageBuffer = await generateImageWithFirefly(enhancedPrompt, fireflyToken, fireflyApiKey);

    // Convert to JPEG with sharp
    const jpegBuffer = await sharp(imageBuffer).jpeg({ quality: 92 }).toBuffer();

    // Calculate hash and prepare upload
    const hash = calculateFileHash(jpegBuffer);
    await ensureBucket(DEFAULT_BUCKET);

    const remotePath = `${slug}.${hash}.jpg`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(DEFAULT_BUCKET)
      .upload(remotePath, jpegBuffer, {
        upsert: true,
        contentType: "image/jpeg",
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage.from(DEFAULT_BUCKET).getPublicUrl(remotePath, {
      download: false,
    });

    const publicUrl = urlData.publicUrl;

    // Update recipe in database with new image URL
    const { error: updateError } = await supabaseAdmin
      .from("recipes")
      .update({ image_url: publicUrl })
      .eq("slug", slug);

    if (updateError) {
      console.error(`Failed to update recipe image_url for ${slug}:`, updateError);
      logApiEndpoint({
        endpoint: `/api/recipes/${slug}/generate-image`,
        method: "POST",
        userId: auth.authorized ? auth.userId : undefined,
        userEmail: auth.authorized ? auth.userEmail : undefined,
        statusCode: 500,
        isProtected: true,
      });
      return NextResponse.json(
        { error: `Failed to update recipe: ${updateError.message}` },
        { status: 500 },
      );
    }

    logApiEndpoint({
      endpoint: `/api/recipes/${slug}/generate-image`,
      method: "POST",
      userId: auth.authorized ? auth.userId : undefined,
      userEmail: auth.authorized ? auth.userEmail : undefined,
      statusCode: 201,
      isProtected: true,
    });
    return NextResponse.json(
      {
        slug,
        path: remotePath,
        publicUrl,
        hash,
        message: "Image generated and uploaded successfully",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Image generation error:", error);
    logApiEndpoint({
      endpoint: `/api/recipes/${slug}/generate-image`,
      method: "POST",
      userId: auth.authorized ? auth.userId : undefined,
      userEmail: auth.authorized ? auth.userEmail : undefined,
      statusCode: 500,
      isProtected: true,
    });
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to generate image: ${message}` }, { status: 500 });
  }
}
