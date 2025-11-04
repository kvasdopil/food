/**
 * Favorites storage utilities for managing recipe favorites in localStorage
 */

const FAVORITES_STORAGE_KEY = "recipe-favorites";

/**
 * Get the favorite status of a recipe by slug
 */
export function getFavoriteStatus(slug: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const favorites = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
    return Array.isArray(favorites) && favorites.includes(slug);
  } catch {
    return false;
  }
}

/**
 * Toggle the favorite status of a recipe
 * @returns The new favorite status after toggling
 */
export function toggleFavoriteStorage(slug: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const favorites = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
    const favoriteList = Array.isArray(favorites) ? favorites : [];
    const index = favoriteList.indexOf(slug);
    
    if (index > -1) {
      // Remove from favorites
      favoriteList.splice(index, 1);
    } else {
      // Add to favorites
      favoriteList.push(slug);
    }
    
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteList));
    return favoriteList.includes(slug);
  } catch {
    return false;
  }
}

/**
 * Get all favorite recipe slugs
 */
export function getAllFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const favorites = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
    return Array.isArray(favorites) ? favorites : [];
  } catch {
    return [];
  }
}

