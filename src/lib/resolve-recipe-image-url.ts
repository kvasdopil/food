import { supabase } from "@/lib/supabaseClient";

export function resolveRecipeImageUrl(imagePath: string | null | undefined) {
  if (!imagePath) {
    return null;
  }

  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  if (!supabase) {
    return null;
  }

  const [bucket, ...pathParts] = imagePath.split("/");
  if (!bucket || pathParts.length === 0) {
    return null;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(pathParts.join("/"));
  return data.publicUrl ?? null;
}

