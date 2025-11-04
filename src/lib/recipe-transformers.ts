/**
 * Utility functions for transforming recipe data between different formats
 */

import type { RecipePartialData } from "@/lib/recipe-store";
import type { RecipeListItem } from "@/types/recipes";

/**
 * Convert a single RecipePartialData to RecipeListItem format
 * Note: Cached partial data may not include time fields, so they'll be null
 */
export function partialToListItem(partial: RecipePartialData): RecipeListItem {
  return {
    slug: partial.slug,
    name: partial.name,
    description: partial.description,
    tags: partial.tags,
    image_url: partial.image_url,
    prep_time_minutes: partial.prep_time_minutes ?? null,
    cook_time_minutes: partial.cook_time_minutes ?? null,
  };
}

/**
 * Convert an array of RecipePartialData to RecipeListItem[] format
 */
export function convertPartialsToRecipeListItems(partials: RecipePartialData[]): RecipeListItem[] {
  return partials.map(partialToListItem);
}

/**
 * Merge cached partial data with recipe list items
 * This allows showing cached data while refreshing
 */
export function mergeCachedWithRecipes(
  recipes: RecipeListItem[],
  getPartial: (slug: string) => RecipePartialData | null,
): RecipeListItem[] {
  return recipes
    .map((recipe) => {
      const cached = getPartial(recipe.slug);
      if (cached) {
        // Merge cached data, preserving recipe's time fields if they exist
        return {
          ...recipe,
          ...partialToListItem(cached),
          // Keep original time fields if they exist in recipe
          prep_time_minutes: recipe.prep_time_minutes ?? cached.prep_time_minutes ?? null,
          cook_time_minutes: recipe.cook_time_minutes ?? cached.cook_time_minutes ?? null,
        };
      }
      return recipe;
    })
    .filter(Boolean);
}
