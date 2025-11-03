"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { fetchRecipeData, type RecipeData } from "@/lib/fetch-recipe-data";
import { recipeStore, type RecipeFullData } from "@/lib/recipe-store";

type UseRecipeResult = {
  recipeData: RecipeData | null;
  isLoading: boolean;
  error: string | null;
};

/**
 * Helper to convert RecipeFullData from store to RecipeData format used by components.
 */
function convertToRecipeData(full: RecipeFullData): RecipeData {
  return {
    slug: full.slug,
    name: full.name,
    description: full.description,
    ingredients: full.ingredients,
    instructions: full.instructions,
    imageUrl: full.imageUrl,
    tags: full.tags,
  };
}

export function useRecipe(slug: string): UseRecipeResult {
  // Check centralized store for cached full data
  const cachedFull = useMemo(() => recipeStore.getFull(slug), [slug]);
  const cachedRecipe = useMemo(() => (cachedFull ? convertToRecipeData(cachedFull) : null), [cachedFull]);
  
  const [recipeData, setRecipeData] = useState<RecipeData | null>(cachedRecipe);
  const [isLoading, setIsLoading] = useState<boolean>(() => !cachedRecipe);
  const [error, setError] = useState<string | null>(null);
  const slugRef = useRef(slug);

  useEffect(() => {
    slugRef.current = slug;
  }, [slug]);

  useEffect(() => {
    let isActive = true;

    async function resolveRecipe() {
      // Check centralized store first
      const existingFull = recipeStore.getFull(slug);
      if (existingFull) {
        const existing = convertToRecipeData(existingFull);
        queueMicrotask(() => {
          if (!isActive || slugRef.current !== slug) return;
          setRecipeData(existing);
          setIsLoading(false);
          setError(null);
        });
        return;
      }

      queueMicrotask(() => {
        if (!isActive || slugRef.current !== slug) return;
        setIsLoading(true);
        setRecipeData(null);
        setError(null);
      });

      try {
        const data = await fetchRecipeData(slug);

        if (!isActive || slugRef.current !== slug) {
          return;
        }

        if (!data) {
          setError("Recipe not found");
          setRecipeData(null);
          setIsLoading(false);
          return;
        }

        // Convert RecipeData to RecipeFullData and store in centralized cache
        const fullData: RecipeFullData = {
          slug: data.slug,
          name: data.name,
          description: data.description,
          ingredients: data.ingredients,
          instructions: data.instructions,
          imageUrl: data.imageUrl,
          tags: data.tags,
        };
        recipeStore.setFull(fullData);
        
        setRecipeData(data);
        setIsLoading(false);
      } catch (err) {
        if (!isActive || slugRef.current !== slug) {
          return;
        }

        console.error("Failed to load recipe:", err);
        setError("Failed to load recipe");
        setRecipeData(null);
        setIsLoading(false);
      }
    }

    resolveRecipe();

    return () => {
      isActive = false;
    };
  }, [slug]);

  return { recipeData, isLoading, error };
}
