"use client";

import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLikes } from "@/contexts/likes-context";

/**
 * Hook for managing favorite status of a recipe
 * Uses the LikesContext for efficient local state management
 * @param slug - The recipe slug to manage favorites for
 * @returns Object with isFavorite status, toggleFavorite function, and loading/error states
 */
export function useFavorites(slug: string) {
  const { user, signInWithGoogle } = useAuth();
  const { isLiked, toggleLike, isLoading, error } = useLikes();

  const isFavorite = isLiked(slug);

  // Toggle favorite status
  const toggleFavorite = useCallback(async (): Promise<boolean> => {
    // If logged out, trigger login flow
    if (!user) {
      await signInWithGoogle();
      // Return current state (will be false since not logged in)
      return false;
    }

    try {
      return await toggleLike(slug);
    } catch (err) {
      console.error("Error toggling like:", err);
      throw err;
    }
  }, [slug, user, toggleLike, signInWithGoogle]);

  return {
    isFavorite,
    toggleFavorite,
    isLoading,
    error,
  };
}
