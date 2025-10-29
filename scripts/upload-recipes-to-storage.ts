import { promises as fs } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const DEFAULT_BUCKET = process.env.RECIPE_STORAGE_BUCKET ?? "recipe-images";
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment before running this script.",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type UploadResult = {
  slug: string;
  bucket: string;
  path: string;
  publicUrl: string;
};

async function ensureBucket(bucket: string) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    throw new Error(`Failed listing buckets: ${error.message}`);
  }

  const exists = buckets?.some((candidate) => candidate.name === bucket);
  if (exists) return;

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: "20MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (createError) {
    throw new Error(`Failed creating bucket ${bucket}: ${createError.message}`);
  }
}

async function uploadImage(bucket: string, localFile: string, remotePath: string) {
  const fileBuffer = await fs.readFile(localFile);
  const { error } = await supabase.storage.from(bucket).upload(remotePath, fileBuffer, {
    upsert: true,
    contentType: "image/jpeg",
  });
  if (error) {
    throw new Error(`Upload failed for ${localFile} -> ${bucket}/${remotePath}: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(remotePath, {
    download: false,
  });

  return data.publicUrl;
}

async function main() {
  await ensureBucket(DEFAULT_BUCKET);

  const baseDir = path.resolve("data/recipes");
  const manifest: UploadResult[] = [];

  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const slug = entry.name;
    const recipeDir = path.join(baseDir, slug);
    const imageFile = path.join(recipeDir, `${slug}.jpg`);

    try {
      await fs.access(imageFile);
    } catch {
      console.warn(`Skipping ${slug}; image not found at ${imageFile}.`);
      continue;
    }

    const remotePath = `${slug}.jpg`;
    const publicUrl = await uploadImage(DEFAULT_BUCKET, imageFile, remotePath);
    manifest.push({
      slug,
      bucket: DEFAULT_BUCKET,
      path: remotePath,
      publicUrl,
    });

    console.log(`Uploaded ${slug} → ${DEFAULT_BUCKET}/${remotePath}`);
  }

  if (manifest.length) {
    const manifestPath = path.resolve("data/recipe-storage-manifest.json");
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
    console.log(`\nSaved manifest: ${manifestPath}`);
  } else {
    console.log("No recipes uploaded.");
  }
}

void main();
