"use client";

import { RecipeFeedCard } from "@/components/recipe-feed-card";
import { RECIPE_GRID_CLASSES } from "@/lib/ui-constants";
import type { RecipeListItem } from "@/types/recipes";

type RecipeGridProps = {
  recipes: RecipeListItem[];
};

/**
 * RecipeGrid component for displaying recipes in a responsive grid layout
 */
export function RecipeGrid({ recipes }: RecipeGridProps) {
  return (
    <div className={RECIPE_GRID_CLASSES}>
      {recipes.map((recipe) => (
        <RecipeFeedCard
          key={recipe.slug}
          slug={recipe.slug}
          name={recipe.name}
          description={recipe.description}
          tags={recipe.tags}
          imageUrl={recipe.image_url}
          prepTimeMinutes={recipe.prep_time_minutes}
          cookTimeMinutes={recipe.cook_time_minutes}
        />
      ))}
    </div>
  );
}
