"use client";

import { useMemo } from "react";
import { recipeStore } from "@/lib/recipe-store";
import { convertPartialsToRecipeListItems, mergeCachedWithRecipes } from "@/lib/recipe-transformers";
import type { RecipeListItem } from "@/hooks/usePaginatedRecipes";

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
 * @returns Object with allCachedRecipes, cachedRecipesForLoading, and displayRecipes
 */
export function useCachedRecipes(
  isLoading: boolean,
  recipes: RecipeListItem[],
): UseCachedRecipesResult {
  // Get all cached recipes from IndexedDB to show immediately on load
  const allCachedRecipes = useMemo(() => {
    // Get all cached partial recipes from store (loaded from IndexedDB)
    const cached = recipeStore.getAllPartials();
    if (cached.length === 0) return null;

    // Convert to RecipeListItem format
    return convertPartialsToRecipeListItems(cached);
  }, []); // Only compute once on mount

  // When loading, try to show cached recipes from previous loads
  const cachedRecipesForLoading = useMemo(() => {
    // If we have cached recipes and no current recipes yet, show cached ones
    if (isLoading && recipes.length === 0 && allCachedRecipes) {
      return allCachedRecipes;
    }

    if (!isLoading || recipes.length === 0) return null;

    // Get cached partial data for the recipes we've already loaded
    // This allows showing cached data while refreshing
    return mergeCachedWithRecipes(recipes, (slug) => recipeStore.getPartial(slug));
  }, [isLoading, recipes, allCachedRecipes]);

  // Determine which recipes to display - use recipes if available, otherwise fall back to cached
  const displayRecipes = useMemo(() => {
    if (recipes.length > 0) {
      return recipes;
    }
    return allCachedRecipes || [];
  }, [recipes, allCachedRecipes]);

  return {
    allCachedRecipes,
    cachedRecipesForLoading,
    displayRecipes,
  };
}

