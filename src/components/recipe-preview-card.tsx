"use client";

import { RecipeFeedCard } from "@/components/recipe-feed-card";
import type { GeneratedRecipe } from "@/types/recipes";

type RecipePreviewCardProps = {
  recipe: GeneratedRecipe;
  isStreaming?: boolean;
};

/**
 * RecipePreviewCard component for displaying generated recipe preview.
 * Supports partial data during streaming and shows loading states for missing fields.
 */
export function RecipePreviewCard({ recipe, isStreaming = false }: RecipePreviewCardProps) {
  // Ensure we have minimum required fields for display
  const displayRecipe = {
    slug: recipe.slug || "loading",
    name: recipe.name || recipe.title || "Loading recipe...",
    description: recipe.description ?? recipe.summary ?? null,
    tags: recipe.tags || [],
    imageUrl: recipe.image_url ?? null,
    prepTimeMinutes: recipe.prepTimeMinutes ?? null,
    cookTimeMinutes: recipe.cookTimeMinutes ?? null,
  };

  // Show a subtle indicator when streaming, but don't block the view
  const isEmpty = !recipe.title && !recipe.name && recipe.tags.length === 0;

  return (
    <div id="generated-recipe-card" className="pointer-events-none relative">
      <div className="pointer-events-none">
        <RecipeFeedCard
          slug={displayRecipe.slug}
          name={displayRecipe.name}
          description={displayRecipe.description}
          tags={displayRecipe.tags}
          imageUrl={displayRecipe.imageUrl}
          prepTimeMinutes={displayRecipe.prepTimeMinutes}
          cookTimeMinutes={displayRecipe.cookTimeMinutes}
        />
        {isStreaming && isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/30 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-lg">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <span className="text-sm font-medium text-gray-700">Generating recipe...</span>
            </div>
          </div>
        )}
        {isStreaming && !isEmpty && (
          <div className="absolute top-2 right-2 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 shadow-sm border border-blue-200">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span className="text-xs font-medium text-blue-700">Streaming...</span>
          </div>
        )}
      </div>
    </div>
  );
}
