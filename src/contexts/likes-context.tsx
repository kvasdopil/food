"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSessionToken } from "@/hooks/useSessionToken";

interface LikesContextValue {
  likedSlugs: Set<string>;
  isLoading: boolean;
  error: string | null;
  toggleLike: (slug: string) => Promise<boolean>;
  refreshLikes: () => Promise<void>;
  isLiked: (slug: string) => boolean;
}

const LikesContext = createContext<LikesContextValue | undefined>(undefined);

export function LikesProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { fetchToken } = useSessionToken();
  const [likedSlugs, setLikedSlugs] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all likes from API
  const fetchAllLikes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (authLoading) {
      setIsLoading(false);
      return;
    }

    if (!user) {
      // Not logged in - no likes
      setLikedSlugs(new Set());
      setIsLoading(false);
      return;
    }

    try {
      const token = await fetchToken();
      if (!token) {
        setError("Failed to get authentication token");
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/recipes/likes", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError("Session expired. Please log in again.");
        } else {
          throw new Error(`Failed to fetch likes: ${response.statusText}`);
        }
        setLikedSlugs(new Set());
      } else {
        const data = await response.json();
        setLikedSlugs(new Set(data.likes || []));
      }
    } catch (err) {
      console.error("Error fetching likes:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch likes";
      setError(errorMessage);
      setLikedSlugs(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [user, authLoading, fetchToken]);

  // Refresh likes
  const refreshLikes = useCallback(async () => {
    await fetchAllLikes();
  }, [fetchAllLikes]);

  // Toggle like for a specific recipe
  const toggleLike = useCallback(
    async (slug: string): Promise<boolean> => {
      if (!user) {
        return false;
      }

      const previousLiked = likedSlugs.has(slug);
      // Optimistic update
      setLikedSlugs((prev) => {
        const next = new Set(prev);
        if (previousLiked) {
          next.delete(slug);
        } else {
          next.add(slug);
        }
        return next;
      });

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
            throw new Error("Session expired. Please log in again.");
          } else {
            throw new Error(`Failed to toggle like: ${response.statusText}`);
          }
        }

        const data = await response.json();
        const newLiked = data.liked ?? false;

        // Update local state with server response
        setLikedSlugs((prev) => {
          const next = new Set(prev);
          if (newLiked) {
            next.add(slug);
          } else {
            next.delete(slug);
          }
          return next;
        });

        return newLiked;
      } catch (err) {
        // Rollback optimistic update on error
        setLikedSlugs((prev) => {
          const next = new Set(prev);
          if (previousLiked) {
            next.add(slug);
          } else {
            next.delete(slug);
          }
          return next;
        });

        console.error("Error toggling like:", err);
        throw err;
      }
    },
    [user, likedSlugs, fetchToken],
  );

  // Check if a recipe is liked
  const isLiked = useCallback(
    (slug: string) => {
      return likedSlugs.has(slug);
    },
    [likedSlugs],
  );

  // Fetch likes when user changes or auth finishes loading
  useEffect(() => {
    fetchAllLikes();
  }, [fetchAllLikes]);

  return (
    <LikesContext.Provider
      value={{
        likedSlugs,
        isLoading,
        error,
        toggleLike,
        refreshLikes,
        isLiked,
      }}
    >
      {children}
    </LikesContext.Provider>
  );
}

export function useLikes() {
  const context = useContext(LikesContext);
  if (context === undefined) {
    throw new Error("useLikes must be used within a LikesProvider");
  }
  return context;
}

