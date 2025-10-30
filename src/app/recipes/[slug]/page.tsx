import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RecipePageClient } from "@/components/recipe/page-client";
import { resolveRecipeImageUrl } from "@/lib/resolve-recipe-image-url";
import { supabase } from "@/lib/supabaseClient";
import type { Tables } from "@/types/supabase";

type Recipe = Tables<"recipes">;

type RecipePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

async function fetchRecipeBySlug(slug: string) {
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

  return data satisfies Recipe | null;
}

export async function generateMetadata({ params }: RecipePageProps): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await fetchRecipeBySlug(slug);

  if (!recipe) {
    return {
      title: "Recipe not found",
    };
  }

  return {
    title: `${recipe.name} | Recipe Thing`,
    description: recipe.description ?? undefined,
    openGraph: {
      title: recipe.name,
      description: recipe.description ?? undefined,
      images: (() => {
        const imageUrl = resolveRecipeImageUrl(recipe.image_url);
        return imageUrl ? [{ url: imageUrl }] : undefined;
      })(),
    },
  };
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { slug } = await params;
  const recipe = await fetchRecipeBySlug(slug);

  if (!recipe) {
    notFound();
  }

  return (
    <RecipePageClient
      recipe={{
        slug: recipe.slug,
        name: recipe.name,
        description: recipe.description ?? "",
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        imageUrl: recipe.image_url,
        tags: recipe.tags ?? [],
      }}
    />
  );
}
