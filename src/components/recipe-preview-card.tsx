"use client";

import { RecipeFeedCard } from "@/components/recipe-feed-card";
import type { GeneratedRecipe } from "@/types/recipes";

type RecipePreviewCardProps = {
  recipe: GeneratedRecipe;
};

/**
 * RecipePreviewCard component for displaying generated recipe preview
 */
export function RecipePreviewCard({ recipe }: RecipePreviewCardProps) {
  return (
    <div id="generated-recipe-card" className="pointer-events-none relative">
      <div className="pointer-events-none">
        <RecipeFeedCard
          slug={recipe.slug}
          name={recipe.name}
          description={recipe.description}
          tags={recipe.tags}
          imageUrl={recipe.image_url}
          prepTimeMinutes={recipe.prepTimeMinutes}
          cookTimeMinutes={recipe.cookTimeMinutes}
        />
      </div>
    </div>
  );
}

