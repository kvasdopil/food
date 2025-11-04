import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdminClient";

/**
 * Calculate SHA-256 hash of a buffer and return first 12 characters.
 */
export function calculateFileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 12);
}

/**
 * Ensure a Supabase storage bucket exists, creating it if necessary.
 */
export async function ensureBucket(bucket: string): Promise<void> {
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

