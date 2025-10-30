import { supabase } from "@/lib/supabaseClient";

export type RecipeData = {
  slug: string;
  name: string;
  description: string;
  ingredients: string;
  instructions: string;
  imageUrl: string | null;
  tags: string[];
};

export async function fetchRecipeData(slug: string): Promise<RecipeData | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load recipe:", error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    slug: data.slug,
    name: data.name,
    description: data.description ?? "",
    ingredients: data.ingredients,
    instructions: data.instructions,
    imageUrl: data.image_url,
    tags: data.tags ?? [],
  };
}
