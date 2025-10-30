"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { fetchRecipeData, type RecipeData } from "@/lib/fetch-recipe-data";

const recipeCache = new Map<string, RecipeData>();

type UseRecipeResult = {
  recipeData: RecipeData | null;
  isLoading: boolean;
  error: string | null;
};

export function useRecipe(slug: string): UseRecipeResult {
  const cachedRecipe = useMemo(() => recipeCache.get(slug) ?? null, [slug]);
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
      const existing = recipeCache.get(slug) ?? null;
      if (existing) {
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

        recipeCache.set(slug, data);
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
