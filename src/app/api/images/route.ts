import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdminClient";

const DEFAULT_BUCKET = process.env.RECIPE_STORAGE_BUCKET ?? "recipe-images";

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

export async function POST(request: NextRequest) {
  const editToken = process.env.EDIT_TOKEN;
  if (!editToken) {
    console.error("POST /api/images missing EDIT_TOKEN environment variable.");
    return NextResponse.json({ error: "Server is not configured for uploads" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const tokenMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  const providedToken = tokenMatch ? tokenMatch[1].trim() : null;

  if (!providedToken || providedToken !== editToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    console.error("Supabase admin client is not configured.");
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const slug = formData.get("slug") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!slug || !slug.trim()) {
      return NextResponse.json({ error: "No slug provided" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 },
      );
    }

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Calculate hash
    const hash = calculateFileHash(buffer);

    // Ensure bucket exists
    await ensureBucket(DEFAULT_BUCKET);

    // Construct remote path with hash
    const remotePath = `${slug.trim()}.${hash}.jpg`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(DEFAULT_BUCKET)
      .upload(remotePath, buffer, {
        upsert: true,
        contentType: file.type,
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
    // Only update if recipe exists (don't create incomplete recipes)
    const { data: existingRecipe, error: checkError } = await supabaseAdmin
      .from("recipes")
      .select("slug")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 is "not found" which is fine
      console.warn(`Error checking for recipe ${slug.trim()}:`, checkError);
    } else if (existingRecipe) {
      const { error: updateError } = await supabaseAdmin
        .from("recipes")
        .update({ image_url: publicUrl })
        .eq("slug", slug.trim());

      if (updateError) {
        console.warn(`Failed to update recipe image_url for ${slug.trim()}:`, updateError);
        // Don't fail the upload, just warn
      }
    } else {
      // Recipe doesn't exist yet - that's fine, image is uploaded and will be linked when recipe is created
      console.log(`Recipe ${slug.trim()} doesn't exist yet, skipping image_url update`);
    }

    return NextResponse.json(
      {
        slug: slug.trim(),
        path: remotePath,
        publicUrl,
        hash,
        recipeUpdated: !!existingRecipe,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Image upload error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to upload image: ${message}` }, { status: 500 });
  }
}
