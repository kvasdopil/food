"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { GeneratedRecipe } from "@/types/recipes";
import { slugify } from "@/lib/recipe-utils";
import { useRecipeImage } from "@/hooks/useRecipeImage";

type UseRecipeGenerationOptions = {
  onSuccess?: (recipe: GeneratedRecipe) => void;
  onError?: (error: string) => void;
};

/**
 * Hook for managing recipe generation and adding
 */
export function useRecipeGeneration(options: UseRecipeGenerationOptions = {}) {
  const router = useRouter();
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null);
  const recipeRef = useRef<GeneratedRecipe | null>(null);
  const imageGenerationStartedRef = useRef(false);
  const currentAccessTokenRef = useRef<string | null>(null);
  const updateRecipeImageRef = useRef<((imageUrl: string) => void) | null>(null);

  // Use recipe image hook for generating images
  const { generateImage } = useRecipeImage({
    onSuccess: (imageUrl) => {
      updateRecipeImageRef.current?.(imageUrl);
    },
  });

  // Helper function to stream updates from an endpoint
  const streamUpdates = async (
    endpoint: string,
    body: Record<string, unknown>,
    accessToken: string,
    onFieldUpdate: (field: string, value: unknown) => void,
  ): Promise<void> => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to call ${endpoint}`);
      } catch {
        throw new Error(`Failed to call ${endpoint}: ${response.status} ${response.statusText}`);
      }
    }

    if (!response.body) {
      throw new Error("Response body is null or undefined");
    }

    // Read streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Decode chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process complete lines (NDJSON format)
      const lines = buffer.split("\n");
      // Keep incomplete line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          continue;
        }

        try {
          const update = JSON.parse(trimmedLine) as
            | { type: "field"; field: string; value: unknown }
            | { type: "complete" }
            | { type: "error"; error: string };

          if (update.type === "field") {
            onFieldUpdate(update.field, update.value);
          } else if (update.type === "complete") {
            return; // Streaming complete
          } else if (update.type === "error") {
            throw new Error(update.error);
          }
        } catch (parseError) {
          if (
            parseError instanceof Error &&
            parseError.message &&
            !(parseError instanceof SyntaxError)
          ) {
            throw parseError;
          }
          // Skip malformed JSON lines
          console.warn("Failed to parse stream update:", parseError, "Line:", trimmedLine);
          continue;
        }
      }
    }

    // Handle any remaining buffer
    if (buffer.trim()) {
      try {
        const update = JSON.parse(buffer.trim());
        if (update.type === "complete") {
          return;
        }
      } catch {
        // Ignore incomplete final chunk
      }
    }
  };

  const generateRecipe = useCallback(
    async (userInput: string, accessToken: string) => {
      if (!userInput.trim() || isParsing || isGenerating) {
        return;
      }

      setIsParsing(true);
      setIsGenerating(false);
      setError(null);
      imageGenerationStartedRef.current = false;
      currentAccessTokenRef.current = accessToken;

      // Initialize with empty recipe so card appears immediately
      const emptyRecipe: GeneratedRecipe = {
        slug: "",
        name: "",
        title: "",
        description: null,
        summary: null,
        tags: [],
        ingredients: [],
        instructions: [],
        image_url: null,
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        servings: null,
        imagePrompt: undefined,
      };
      recipeRef.current = emptyRecipe;
      setGeneratedRecipe(emptyRecipe);

      try {
        // Step 1: Parse user input (streaming)
        const parsedData: {
          title?: string;
          description?: string;
          tags?: string[];
          userComment?: string;
          servings?: number;
          cuisine?: string;
        } = {};

        await streamUpdates(
          "/api/recipes/parse-user-input-stream",
          { userInput: userInput.trim() },
          accessToken,
          (field, value) => {
            if (field === "title") {
              parsedData.title = value as string;
              setGeneratedRecipe((prev) => {
                const updated = {
                  ...prev!,
                  title: value as string,
                  name: value as string,
                  slug: slugify(value as string),
                };
                recipeRef.current = updated;
                return updated;
              });
            } else if (field === "description") {
              parsedData.description = value as string;
              setGeneratedRecipe((prev) => {
                const updated = {
                  ...prev!,
                  description: value as string | null,
                  summary: value as string | null,
                };
                recipeRef.current = updated;
                return updated;
              });

              // Generate image as soon as we have description
              if (
                !imageGenerationStartedRef.current &&
                typeof value === "string" &&
                value.trim() &&
                currentAccessTokenRef.current
              ) {
                imageGenerationStartedRef.current = true;
                // Start image generation in background (don't await)
                generateImage(value.trim(), currentAccessTokenRef.current).catch((err) => {
                  console.error("Failed to generate image:", err);
                  // Don't show error to user - image generation is not critical
                });
              }
            } else if (field === "tags") {
              parsedData.tags = (value as string[]) || [];
              setGeneratedRecipe((prev) => {
                const updated = {
                  ...prev!,
                  tags: (value as string[]) || [],
                };
                recipeRef.current = updated;
                return updated;
              });
            } else if (field === "userComment") {
              parsedData.userComment = value as string;
            } else if (field === "servings") {
              parsedData.servings = value as number;
            } else if (field === "cuisine") {
              parsedData.cuisine = value as string;
            }
          },
        );

        setIsParsing(false);

        // Validate parsed data
        if (
          !parsedData.title ||
          !parsedData.description ||
          !parsedData.tags ||
          parsedData.tags.length === 0
        ) {
          throw new Error("Failed to parse user input: missing required fields");
        }

        // Step 2: Generate recipe (streaming)
        setIsGenerating(true);

        await streamUpdates(
          "/api/recipes/generate-stream",
          {
            title: parsedData.title,
            description: parsedData.description,
            tags: parsedData.tags,
            userComment: parsedData.userComment,
            servings: parsedData.servings,
            cuisine: parsedData.cuisine,
          },
          accessToken,
          (field, value) => {
            setGeneratedRecipe((prev) => {
              if (!prev) return prev;
              const updated = { ...prev };

              if (field === "title") {
                updated.title = value as string;
                updated.name = value as string;
                updated.slug = slugify(value as string);
              } else if (field === "summary") {
                updated.summary = value as string | null;
                updated.description = value as string | null;
              } else if (field === "tags") {
                updated.tags = (value as string[]) || [];
              } else if (field === "ingredients") {
                updated.ingredients = (value as Array<{ name: string; amount: string }>) || [];
              } else if (field === "instructions") {
                updated.instructions = (value as Array<{ step?: number; action: string }>) || [];
              } else if (field === "servings") {
                updated.servings = value as number | null;
              } else if (field === "prepTimeMinutes") {
                updated.prepTimeMinutes = value as number | null;
              } else if (field === "cookTimeMinutes") {
                updated.cookTimeMinutes = value as number | null;
              }

              recipeRef.current = updated;
              return updated;
            });
          },
        );

        setIsGenerating(false);
        // Get the final recipe from ref (which tracks the latest state)
        if (recipeRef.current?.title) {
          options.onSuccess?.(recipeRef.current);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to generate recipe";
        setError(errorMessage);
        setIsParsing(false);
        setIsGenerating(false);
        options.onError?.(errorMessage);
      }
    },
    [isParsing, isGenerating, options, generateImage],
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
      const updated = {
        ...prev,
        image_url: imageUrl,
      };
      recipeRef.current = updated;
      return updated;
    });
  }, []);

  // Keep ref updated so it can be used in the hook callback
  useEffect(() => {
    updateRecipeImageRef.current = updateRecipeImage;
  }, [updateRecipeImage]);

  const reset = useCallback(() => {
    setGeneratedRecipe(null);
    setError(null);
    setIsParsing(false);
    setIsGenerating(false);
    setIsAdding(false);
    imageGenerationStartedRef.current = false;
    currentAccessTokenRef.current = null;
    recipeRef.current = null;
  }, []);

  return {
    generatedRecipe,
    isParsing,
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
