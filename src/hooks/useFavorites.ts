"use client";

import { useState, useEffect, useCallback } from "react";
import { getFavoriteStatus, toggleFavoriteStorage } from "@/lib/favorites-storage";

/**
 * Hook for managing favorite status of a recipe
 * @param slug - The recipe slug to manage favorites for
 * @returns Object with isFavorite status and toggleFavorite function
 */
export function useFavorites(slug: string) {
  const [isFavorite, setIsFavorite] = useState(() => getFavoriteStatus(slug));

  // Update favorite status when slug changes
  useEffect(() => {
    setIsFavorite(getFavoriteStatus(slug));
  }, [slug]);

  // Toggle favorite status and update localStorage
  const toggleFavorite = useCallback(() => {
    const newStatus = toggleFavoriteStorage(slug);
    setIsFavorite(newStatus);
    return newStatus;
  }, [slug]);

  return { isFavorite, toggleFavorite };
}

