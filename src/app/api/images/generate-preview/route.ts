import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";

import { supabaseAdmin } from "@/lib/supabaseAdminClient";
import { authenticateRequest } from "@/lib/api-auth";
import { generateImageWithGoogleAI } from "@/lib/google-image-generation";
import { logApiEndpoint } from "@/lib/analytics";
import { calculateFileHash, ensureBucket } from "@/lib/image-storage-utils";

const DEFAULT_BUCKET = process.env.RECIPE_STORAGE_BUCKET ?? "recipe-images";

export async function POST(request: NextRequest) {
  // Authenticate the request - allows either EDIT_TOKEN or Supabase session
  const auth = await authenticateRequest(request);

  if (!auth.authorized) {
    logApiEndpoint({
      endpoint: "/api/images/generate-preview",
      method: "POST",
      statusCode: 401,
      isProtected: true,
    });
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
  }

  // Log endpoint usage
  logApiEndpoint({
    endpoint: "/api/images/generate-preview",
    method: "POST",
    userId: auth.userId,
    userEmail: auth.userEmail,
    isProtected: true,
  });

  if (!supabaseAdmin) {
    console.error("Supabase admin client is not configured.");
    logApiEndpoint({
      endpoint: "/api/images/generate-preview",
      method: "POST",
      userId: auth.userId,
      userEmail: auth.userEmail,
      statusCode: 500,
      isProtected: true,
    });
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    const json = await request.json();
    const description = typeof json.description === "string" ? json.description.trim() : null;

    if (!description) {
      logApiEndpoint({
        endpoint: "/api/images/generate-preview",
        method: "POST",
        userId: auth.userId,
        userEmail: auth.userEmail,
        statusCode: 400,
        isProtected: true,
      });
      return NextResponse.json({ error: "Description parameter is required" }, { status: 400 });
    }

    // Generate image using Google AI
    console.log(`Generating preview image with description: ${description.substring(0, 100)}...`);
    const { imageData, contentType } = await generateImageWithGoogleAI({
      description,
      model: "gemini-2.5-flash-image", // Use gemini-2.5-flash-image model
    });

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
      logApiEndpoint({
        endpoint: "/api/images/generate-preview",
        method: "POST",
        userId: auth.userId,
        userEmail: auth.userEmail,
        statusCode: 500,
        isProtected: true,
      });
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage.from(DEFAULT_BUCKET).getPublicUrl(remotePath, {
      download: false,
    });

    const publicUrl = urlData.publicUrl;

    // Note: This endpoint does NOT update the database as requested

    logApiEndpoint({
      endpoint: "/api/images/generate-preview",
      method: "POST",
      userId: auth.userId,
      userEmail: auth.userEmail,
      statusCode: 201,
      isProtected: true,
    });
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
    logApiEndpoint({
      endpoint: "/api/images/generate-preview",
      method: "POST",
      userId: auth.userId,
      userEmail: auth.userEmail,
      statusCode: 500,
      isProtected: true,
    });
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate preview image: ${message}` },
      { status: 500 },
    );
  }
}
