import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";

import { supabaseAdmin } from "@/lib/supabaseAdminClient";
import { authenticateRequest } from "@/lib/api-auth";
import { generateImageWithGoogleAI } from "@/lib/google-image-generation";

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
  // Authenticate the request - allows either EDIT_TOKEN or Supabase session
  const auth = await authenticateRequest(request);

  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    console.error("Supabase admin client is not configured.");
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("POST /api/images/generate-preview missing GEMINI_API_KEY or GOOGLE_API_KEY.");
    return NextResponse.json(
      { error: "Server is not configured for image generation" },
      { status: 500 },
    );
  }

  try {
    const json = await request.json();
    const description = typeof json.description === "string" ? json.description.trim() : null;

    if (!description) {
      return NextResponse.json({ error: "Description parameter is required" }, { status: 400 });
    }

    // Generate image using Google AI
    console.log(`Generating preview image with description: ${description.substring(0, 100)}...`);
    const { imageData, contentType } = await generateImageWithGoogleAI(
      {
        description,
        model: "gemini-2.5-flash-image", // Use gemini-2.5-flash-image model
      },
      apiKey,
    );

    // Convert to JPEG with sharp (regardless of input format)
    // Check if already JPEG to avoid unnecessary conversion
    const jpegBuffer =
      contentType === "image/jpeg"
        ? imageData
        : await sharp(imageData).jpeg({ quality: 92 }).toBuffer();

    // Calculate hash
    const hash = calculateFileHash(jpegBuffer);

    // Ensure bucket exists
    await ensureBucket(DEFAULT_BUCKET);

    // Construct remote path: preview.{hash}.jpg
    const remotePath = `preview.${hash}.jpg`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(DEFAULT_BUCKET)
      .upload(remotePath, jpegBuffer, {
        upsert: true, // Allow overwriting if same hash
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

    // Note: This endpoint does NOT update the database as requested

    return NextResponse.json(
      {
        url: publicUrl,
        path: remotePath,
        hash,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Preview image generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate preview image: ${message}` },
      { status: 500 },
    );
  }
}
