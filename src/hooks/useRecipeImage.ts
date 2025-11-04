"use client";

import { useState, useCallback, useRef, useEffect } from "react";

type UseRecipeImageOptions = {
  onSuccess?: (imageUrl: string) => void;
  onError?: (error: string) => void;
};

/**
 * Hook for managing recipe image generation
 */
export function useRecipeImage(options: UseRecipeImageOptions = {}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const optionsRef = useRef(options);

  // Keep options ref up to date without causing callback recreation
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const generateImage = useCallback(
    async (imagePrompt: string, accessToken: string): Promise<string | null> => {
      setIsGenerating(true);
      setError(null);

      try {
        const response = await fetch("/api/images/generate-preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            description: imagePrompt,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to generate preview image");
        }

        const data = await response.json();
        setIsGenerating(false);
        optionsRef.current.onSuccess?.(data.url);
        return data.url;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to generate preview image";
        setError(errorMessage);
        setIsGenerating(false);
        // Don't call onError for image generation - it's not critical
        console.error("Failed to generate preview image:", err);
        return null;
      }
    },
    [], // Empty dependency array - options accessed via ref
  );

  return {
    isGenerating,
    error,
    generateImage,
  };
}
