"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSessionToken } from "@/hooks/useSessionToken";
import { getFavoriteStatus } from "@/lib/favorites-storage";

/**
 * Hook for managing favorite status of a recipe
 * Uses API endpoints for logged-in users, falls back to localStorage for logged-out users (migration support)
 * @param slug - The recipe slug to manage favorites for
 * @returns Object with isFavorite status, toggleFavorite function, and loading/error states
 */
export function useFavorites(slug: string) {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const { fetchToken } = useSessionToken();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch like status from API when logged in, or from localStorage when logged out
  useEffect(() => {
    const fetchLikeStatus = async () => {
      setIsLoading(true);
      setError(null);

      if (authLoading) {
        // Wait for auth to finish loading
        return;
      }

      if (!user) {
        // Not logged in - check localStorage for migration support
        setIsFavorite(getFavoriteStatus(slug));
        setIsLoading(false);
        return;
      }

      // Logged in - fetch from API
      try {
        const token = await fetchToken();
        if (!token) {
          setError("Failed to get authentication token");
          setIsLoading(false);
          return;
        }

        const response = await fetch(`/api/recipes/${slug}/like`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            // Recipe not found - treat as not liked
            setIsFavorite(false);
          } else if (response.status === 401) {
            // Token expired or invalid - clear error but don't show as liked
            setError("Session expired. Please log in again.");
            setIsFavorite(false);
          } else {
            throw new Error(`Failed to fetch like status: ${response.statusText}`);
          }
        } else {
          const data = await response.json();
          setIsFavorite(data.liked ?? false);
        }
      } catch (err) {
        console.error("Error fetching like status:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch like status";
        
        // Check if it's a network error or auth error
        if (errorMessage.includes("Authentication") || errorMessage.includes("token")) {
          setError("Session expired. Please log in again.");
        } else {
          setError(errorMessage);
        }
        // Fallback to false on error
        setIsFavorite(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLikeStatus();
  }, [slug, user, authLoading, fetchToken]);

  // Toggle favorite status
  const toggleFavorite = useCallback(async (): Promise<boolean> => {
    // If logged out, trigger login flow
    if (!user) {
      await signInWithGoogle();
      // Return current state (will be false since not logged in)
      return false;
    }

    // Optimistic update
    const previousStatus = isFavorite;
    setIsFavorite(!previousStatus);
    setError(null);

    try {
      const token = await fetchToken();
      if (!token) {
        throw new Error("Failed to get authentication token");
      }

      const response = await fetch(`/api/recipes/${slug}/like`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Recipe not found");
        } else if (response.status === 401) {
          // Token expired - trigger re-login
          const authError = new Error("Session expired. Please log in again.");
          (authError as Error & { requiresAuth: boolean }).requiresAuth = true;
          throw authError;
        } else {
          throw new Error(`Failed to toggle like: ${response.statusText}`);
        }
      }

      const data = await response.json();
      setIsFavorite(data.liked ?? false);
      return data.liked ?? false;
    } catch (err) {
      // Rollback optimistic update on error
      setIsFavorite(previousStatus);
      const errorMessage = err instanceof Error ? err.message : "Failed to toggle like";
      
      // Check if authentication is required
      const requiresAuth =
        err instanceof Error &&
        ("requiresAuth" in err || errorMessage.includes("Authentication") || errorMessage.includes("Session expired"));
      
      if (requiresAuth) {
        setError("Session expired. Please log in again.");
        // Optionally trigger re-login
        if (errorMessage.includes("Session expired")) {
          // User will need to manually log in again
          console.warn("Authentication expired, user should log in again");
        }
      } else {
        setError(errorMessage);
      }
      
      console.error("Error toggling like:", err);
      throw err;
    }
  }, [slug, user, isFavorite, fetchToken, signInWithGoogle]);

  return {
    isFavorite,
    toggleFavorite,
    isLoading,
    error,
  };
}
