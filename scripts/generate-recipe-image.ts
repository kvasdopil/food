import { promises as fs } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import sharp from "sharp";

type FireflyJobResponse = {
  links?: {
    cancel?: {
      href: string;
    };
    result?: {
      href: string;
    };
  };
  jobId?: string; // Fallback for other API versions
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
      url?: string; // Fallback for other formats
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
  status?: "pending" | "running" | "succeeded" | "failed" | "cancel_pending" | "cancelled" | "timeout"; // Fallback
  links?: {
    result?: {
      href: string;
    };
    cancel?: {
      href: string;
    };
  };
};

type RecipeYaml = {
  title: string;
  imagePrompt?: {
    base?: string;
    enhanced?: string;
  };
  [key: string]: unknown;
};

const OUTPUT_BASE = path.resolve(process.cwd(), "data/recipes");

async function loadEnvValue(key: string): Promise<string | undefined> {
  if (process.env[key]) {
    return process.env[key];
  }

  const envLocalPath = path.resolve(".env.local");

  try {
    const content = await fs.readFile(envLocalPath, "utf-8");
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const [lineKey, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim();
      if (!value) continue;

      if (lineKey === key) {
        process.env[key] = value;
        return value;
      }
    }
  } catch {
    // ignore missing file
  }

  return undefined;
}

async function loadFireflyToken() {
  return loadEnvValue("FIREFLY_API_TOKEN");
}

async function loadFireflyApiKey() {
  // Default to "clio-playground-web" if not specified
  return (await loadEnvValue("FIREFLY_API_KEY")) || "clio-playground-web";
}

async function generateImageWithFirefly(
  prompt: string,
  token: string,
  apiKey: string,
): Promise<{ data: string; mimeType: string }> {
  // Using the v5 endpoint that works
  const FIREFLY_BASE_URL = "https://image-v5.ff.adobe.io";

  // Step 1: Submit generation job
  const submitUrl = `${FIREFLY_BASE_URL}/v1/images/generate-async`;
  const submitResponse = await fetch(submitUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "accept": "*/*",
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
      statusUrl = jobData.links.result.href; // Use the provided result URL
    }
  } else if (jobData.jobId) {
    // Fallback for other API versions that return jobId directly
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
        "Authorization": `Bearer ${token}`,
        "x-api-key": apiKey,
        "accept": "*/*",
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
        console.log(`Downloading image from presigned URL...`);
        const imageResponse = await fetch(imageUrl);

        if (!imageResponse.ok) {
          throw new Error(`Failed to download Firefly image (${imageResponse.status})`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Data = Buffer.from(imageBuffer).toString("base64");

        return {
          data: base64Data,
          mimeType: "image/jpeg",
        };
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
      const base64Data = Buffer.from(imageBuffer).toString("base64");

      return {
        data: base64Data,
        mimeType: "image/jpeg",
      };
    }

    // Job is still in progress - check progress if available
    const progress = status.progress;
    if (progress !== undefined) {
      if (progress >= 100) {
        // Progress is 100 but no image URL yet - wait a bit more
        console.log(`Progress: ${progress}% - waiting for final image URL...`);
      } else {
        if ((attempt + 1) % 6 === 0) {
          // Log progress every 30 seconds
          console.log(`Progress: ${progress.toFixed(1)}%`);
        }
      }
    } else if (status.status === "succeeded") {
      // Legacy status field indicates success
      throw new Error("Job marked as succeeded but no image URL found in response");
    }

    // Continue polling - no image URL found yet
    if (status.status && status.status !== "pending" && status.status !== "running") {
      throw new Error(`Unexpected Firefly job status: ${status.status}`);
    }
  }

  throw new Error("Firefly image generation timed out after maximum polling attempts");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function printUsage() {
  const usageMessage = `
Usage: ts-node scripts/generate-recipe-image.ts <yaml-file>

Arguments:
  yaml-file               Path to the recipe YAML file (e.g. data/recipes/my-recipe/my-recipe.yaml)

The script will:
  1. Read the YAML file and extract the image prompt (uses 'enhanced' prompt if available, falls back to 'base')
  2. Generate an image using Firefly API
  3. Save the image as {slug}.jpg in the same directory as the YAML file
  4. Update metadata.json with image generation info

Options:
  -h, --help              Show this message.
`;
  console.log(usageMessage.trim());
}

async function main() {
  try {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
      printUsage();
      process.exit(0);
    }

    const yamlFilePath = args[0];
    if (!yamlFilePath.endsWith(".yaml") && !yamlFilePath.endsWith(".yml")) {
      throw new Error("Input file must be a YAML file (.yaml or .yml)");
    }

    const fireflyToken = await loadFireflyToken();
    const fireflyApiKey = await loadFireflyApiKey();
    
    if (!fireflyToken) {
      throw new Error(
        "Provide FIREFLY_API_TOKEN via env or .env.local before running this script.",
      );
    }

    // Read YAML file
    const yamlContent = await fs.readFile(yamlFilePath, "utf-8");
    const recipe = yaml.load(yamlContent) as RecipeYaml;

    if (!recipe.title) {
      throw new Error("YAML file must contain a 'title' field");
    }

    // Get image prompt (prefer enhanced, fall back to base)
    const imagePrompt = recipe.imagePrompt?.enhanced || recipe.imagePrompt?.base;
    if (!imagePrompt) {
      throw new Error(
        "YAML file must contain an 'imagePrompt' field with 'base' or 'enhanced' prompt",
      );
    }

    console.log(`Generating image for: ${recipe.title}`);
    console.log(`Using prompt: ${imagePrompt.substring(0, 100)}...`);

    // Generate image
    const imageData = await generateImageWithFirefly(imagePrompt, fireflyToken, fireflyApiKey);
    const imageBuffer = Buffer.from(imageData.data, "base64");
    const jpegBuffer = await sharp(imageBuffer).jpeg({ quality: 92 }).toBuffer();

    // Determine output directory and filename
    const yamlDir = path.dirname(yamlFilePath);
    const slug = slugify(recipe.title);
    const imageFile = path.join(yamlDir, `${slug}.jpg`);
    await fs.writeFile(imageFile, jpegBuffer);

    // Update metadata.json if it exists
    const metadataFile = path.join(yamlDir, "metadata.json");
    let metadata: Record<string, unknown> = {};
    try {
      const metadataContent = await fs.readFile(metadataFile, "utf-8");
      metadata = JSON.parse(metadataContent) as Record<string, unknown>;
    } catch {
      // metadata.json doesn't exist, create new one
    }

    metadata.imageFile = path.basename(imageFile);
    metadata.imageGeneratedAt = new Date().toISOString();
    if (!metadata.imagePrompt) {
      metadata.imagePrompt = recipe.imagePrompt;
    }

    await fs.writeFile(metadataFile, `${JSON.stringify(metadata, null, 2)}\n`, "utf-8");

    console.log(`Image saved to ${imageFile}`);
    console.log(`Metadata updated in ${metadataFile}`);
  } catch (error) {
    console.error(`[generate-recipe-image] ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

void main();

