"use client";

import { useMemo, useState } from "react";
import { recipeStore } from "@/lib/recipe-store";
import {
  convertPartialsToRecipeListItems,
  mergeCachedWithRecipes,
} from "@/lib/recipe-transformers";
import type { RecipeListItem } from "@/types/recipes";

type UseCachedRecipesResult = {
  /**
   * All cached recipes from IndexedDB (for showing immediately on load)
   * Returns null if no cached recipes exist
   */
  allCachedRecipes: RecipeListItem[] | null;
  /**
   * Cached recipes to show while loading
   * Returns cached recipes if loading and no recipes yet, or merged recipes during loading
   * Returns null if not loading or no recipes to merge
   */
  cachedRecipesForLoading: RecipeListItem[] | null;
  /**
   * Recipes to display - uses recipes if available, otherwise falls back to cached
   */
  displayRecipes: RecipeListItem[];
};

/**
 * Hook for managing cached recipe data from IndexedDB.
 * Handles conversion and merging of cached partial data with current recipes.
 *
 * @param isLoading - Whether recipes are currently loading
 * @param recipes - Current recipes from API
 * @param shouldUseCache - Whether to use cached recipes as fallback (default: true)
 * @returns Object with allCachedRecipes, cachedRecipesForLoading, and displayRecipes
 */
export function useCachedRecipes(
  isLoading: boolean,
  recipes: RecipeListItem[],
  shouldUseCache: boolean = true,
): UseCachedRecipesResult {
  // Get all cached recipes from IndexedDB to show immediately on load
  // Use useState with lazy initialization to avoid hydration mismatch (IndexedDB only available on client)
  const [allCachedRecipes] = useState<RecipeListItem[] | null>(() => {
    // Lazy initialization: only runs on client, avoids hydration mismatch
    if (typeof window === "undefined") return null;
    
    const cached = recipeStore.getAllPartials();
    if (cached.length === 0) return null;

    // Convert to RecipeListItem format
    return convertPartialsToRecipeListItems(cached);
  });

  // When loading, try to show cached recipes from previous loads
  const cachedRecipesForLoading = useMemo(() => {
    // Don't use cache if it's disabled (e.g., when filters are active)
    if (!shouldUseCache) return null;

    // If we have cached recipes and no current recipes yet, show cached ones
    if (isLoading && recipes.length === 0 && allCachedRecipes) {
      return allCachedRecipes;
    }

    if (!isLoading || recipes.length === 0) return null;

    // Get cached partial data for the recipes we've already loaded
    // This allows showing cached data while refreshing
    return mergeCachedWithRecipes(recipes, (slug) => recipeStore.getPartial(slug));
  }, [isLoading, recipes, allCachedRecipes, shouldUseCache]);

  // Determine which recipes to display - use recipes if available, otherwise fall back to cached
  const displayRecipes = useMemo(() => {
    if (recipes.length > 0) {
      return recipes;
    }
    // Only fall back to cache if it's enabled
    if (shouldUseCache) {
      return allCachedRecipes || [];
    }
    // If cache is disabled and recipes is empty, return empty array
    return [];
  }, [recipes, allCachedRecipes, shouldUseCache]);

  return {
    allCachedRecipes,
    cachedRecipesForLoading,
    displayRecipes,
  };
}
