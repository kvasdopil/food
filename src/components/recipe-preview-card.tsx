"use client";

import { RecipeFeedCard } from "@/components/recipe-feed-card";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { generatedRecipeToFeedCardProps } from "@/lib/recipe-transformers";
import type { GeneratedRecipe } from "@/types/recipes";
import type { ReactNode } from "react";

type RecipePreviewCardProps = {
  recipe: GeneratedRecipe;
  isStreaming?: boolean;
  actionButton?: ReactNode;
  showCreatingOverlay?: boolean;
};

/**
 * RecipePreviewCard component for displaying generated recipe preview.
 * Supports partial data during streaming and shows loading states for missing fields.
 */
export function RecipePreviewCard({
  recipe,
  isStreaming = false,
  actionButton,
  showCreatingOverlay = false,
}: RecipePreviewCardProps) {
  const displayRecipe = generatedRecipeToFeedCardProps(recipe);
  const isEmpty = !recipe.title && !recipe.name && recipe.tags.length === 0;

  return (
    <div id="generated-recipe-card" className="relative">
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
        {showCreatingOverlay && <LoadingOverlay message="Creating..." variant="full" />}
        {isStreaming && isEmpty && !showCreatingOverlay && (
          <LoadingOverlay message="Generating recipe..." variant="full" />
        )}
        {isStreaming && !isEmpty && !showCreatingOverlay && (
          <LoadingOverlay message="Streaming..." variant="badge" />
        )}
      </div>
      {actionButton && <div className="pointer-events-auto mt-4">{actionButton}</div>}
    </div>
  );
}
