"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { GeneratedRecipe } from "@/types/recipes";

type UseRecipeGenerationOptions = {
  onSuccess?: (recipe: GeneratedRecipe) => void;
  onError?: (error: string) => void;
};

/**
 * Hook for managing recipe generation and adding
 */
export function useRecipeGeneration(options: UseRecipeGenerationOptions = {}) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null);

  const generateRecipe = useCallback(
    async (userInput: string, accessToken: string) => {
      if (!userInput.trim() || isGenerating) {
        return;
      }

      setIsGenerating(true);
      setError(null);

      try {
        const response = await fetch("/api/recipes/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            userInput: userInput.trim(),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to generate recipe");
        }

        const data = await response.json();
        const recipe = data.recipe;

        const recipeData: GeneratedRecipe = {
          slug: recipe.slug,
          name: recipe.name,
          description: recipe.description,
          tags: recipe.tags || [],
          image_url: recipe.image_url,
          prepTimeMinutes: recipe.prepTimeMinutes,
          cookTimeMinutes: recipe.cookTimeMinutes,
          title: recipe.title,
          summary: recipe.summary,
          ingredients: recipe.ingredients || [],
          instructions: recipe.instructions || [],
          servings: recipe.servings,
          imagePrompt: recipe.imagePrompt,
        };

        setGeneratedRecipe(recipeData);
        setIsGenerating(false);
        options.onSuccess?.(recipeData);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to generate recipe";
        setError(errorMessage);
        setIsGenerating(false);
        options.onError?.(errorMessage);
      }
    },
    [isGenerating, options],
  );

  const addRecipe = useCallback(
    async (recipe: GeneratedRecipe, accessToken: string, onClose: () => void) => {
      if (!recipe || isAdding) {
        return;
      }

      setIsAdding(true);
      setError(null);

      try {
        const recipePayload = {
          slug: recipe.slug,
          title: recipe.title,
          summary: recipe.summary,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          tags: recipe.tags,
          imageUrl: recipe.image_url,
          prepTimeMinutes: recipe.prepTimeMinutes,
          cookTimeMinutes: recipe.cookTimeMinutes,
        };

        const response = await fetch("/api/recipes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(recipePayload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to add recipe");
        }

        const data = await response.json();
        const createdSlug = data.recipe?.slug || recipe.slug;

        // Navigate to the newly created recipe page
        router.push(`/recipes/${createdSlug}`);
        onClose();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to add recipe";
        setError(errorMessage);
        setIsAdding(false);
        options.onError?.(errorMessage);
      }
    },
    [isAdding, router, options],
  );

  const updateRecipeImage = useCallback((imageUrl: string) => {
    setGeneratedRecipe((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        image_url: imageUrl,
      };
    });
  }, []);

  const reset = useCallback(() => {
    setGeneratedRecipe(null);
    setError(null);
    setIsGenerating(false);
    setIsAdding(false);
  }, []);

  return {
    generatedRecipe,
    isGenerating,
    isAdding,
    error,
    generateRecipe,
    addRecipe,
    updateRecipeImage,
    reset,
    setError,
  };
}
