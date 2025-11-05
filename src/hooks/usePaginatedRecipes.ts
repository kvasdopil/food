"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { recipeStore } from "@/lib/recipe-store";
import type { RecipeListItem } from "@/types/recipes";
import { useSessionToken } from "@/hooks/useSessionToken";

export type PaginationInfo = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

type RecipesResponse = {
  recipes: RecipeListItem[];
  pagination: PaginationInfo;
};

type UsePaginatedRecipesOptions = {
  tags?: string[];
  searchQuery?: string;
  favorites?: boolean;
  autoLoadInitial?: boolean;
};

type UsePaginatedRecipesResult = {
  recipes: RecipeListItem[];
  pagination: PaginationInfo | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  loadInitialRecipes: () => Promise<void>;
  loadMore: () => Promise<void>;
  retry: () => Promise<void>;
};

/**
 * Hook for managing paginated recipe feed with request cancellation and duplicate prevention.
 *
 * Features:
 * - Cancels in-flight requests when new ones are initiated
 * - Prevents duplicate loads with the same pagination slug
 * - Handles loading states and errors
 * - Supports tag filtering
 */
export function usePaginatedRecipes(
  options: UsePaginatedRecipesOptions = {},
): UsePaginatedRecipesResult {
  const { tags = [], searchQuery = "", favorites = false, autoLoadInitial = true } = options;

  const { fetchToken } = useSessionToken();

  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(autoLoadInitial);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingFromSlugRef = useRef<string | null>(null);

  const fetchRecipes = useCallback(
    async (
      fromSlug?: string,
      tagsToFetch?: string[],
      searchToFetch?: string,
      favoritesToFetch?: boolean,
      signal?: AbortSignal,
    ) => {
      try {
        const params = new URLSearchParams();
        if (fromSlug) {
          params.append("from", fromSlug);
        }
        if (tagsToFetch && tagsToFetch.length > 0) {
          params.append("tags", tagsToFetch.join("+"));
        }
        if (searchToFetch && searchToFetch.trim()) {
          params.append("q", searchToFetch.trim());
        }
        if (favoritesToFetch) {
          params.append("favorites", "true");
        }

        // Get auth token if favorites filter is enabled
        const headers: HeadersInit = {};
        if (favoritesToFetch) {
          const token = await fetchToken();
          if (!token) {
            throw new Error("Authentication required for favorites filter");
          }
          headers.Authorization = `Bearer ${token}`;
        }

        const queryString = params.toString();
        const url = queryString ? `/api/recipes?${queryString}` : `/api/recipes`;
        const response = await fetch(url, { signal, headers });
        if (!response.ok) {
          if (response.status === 401) {
            // Token expired or invalid
            const authError = new Error("Session expired. Please log in again to view favorites.");
            (authError as Error & { requiresAuth: boolean }).requiresAuth = true;
            throw authError;
          } else if (response.status === 403) {
            throw new Error("Access denied. Please log in again.");
          } else {
            throw new Error(`Failed to fetch recipes: ${response.statusText}`);
          }
        }
        const data: RecipesResponse = await response.json();
        return data;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw err;
        }
        // Enhance error messages for network issues
        if (err instanceof Error && err.message.includes("Failed to fetch")) {
          throw new Error("Network error. Please check your connection and try again.");
        }
        throw err;
      }
    },
    [fetchToken],
  );

  const loadInitialRecipes = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    loadingFromSlugRef.current = null;

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchRecipes(
        undefined,
        tags,
        searchQuery,
        favorites,
        abortController.signal,
      );

      // Only update if this request wasn't aborted
      if (!abortController.signal.aborted) {
        // Store recipes in centralized cache
        recipeStore.setPartials(data.recipes);
        setRecipes(data.recipes);
        setPagination(data.pagination);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load recipes");
    } finally {
      if (!abortController.signal.aborted || abortControllerRef.current === abortController) {
        setIsLoading(false);
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    }
  }, [fetchRecipes, tags, searchQuery, favorites]);

  const loadMore = useCallback(async () => {
    if (!pagination || !pagination.hasMore || isLoadingMore || recipes.length === 0) return;

    // Use the slug of the last recipe in the current list for pagination
    const lastRecipe = recipes[recipes.length - 1];
    const fromSlug = lastRecipe.slug;

    // Prevent duplicate loads with the same fromSlug
    if (loadingFromSlugRef.current === fromSlug) {
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    loadingFromSlugRef.current = fromSlug;

    setIsLoadingMore(true);
    try {
      const data = await fetchRecipes(
        fromSlug,
        tags,
        searchQuery,
        favorites,
        abortController.signal,
      );

      // Only update if this request wasn't aborted
      if (!abortController.signal.aborted) {
        // Store new recipes in centralized cache
        recipeStore.setPartials(data.recipes);
        setRecipes((prev) => [...prev, ...data.recipes]);
        setPagination(data.pagination);
        loadingFromSlugRef.current = null;
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load more recipes");
      loadingFromSlugRef.current = null;
    } finally {
      // Only reset loading state if this wasn't aborted (or if it was, clean up)
      if (!abortController.signal.aborted || abortControllerRef.current === abortController) {
        setIsLoadingMore(false);
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    }
  }, [pagination, isLoadingMore, fetchRecipes, recipes, tags, searchQuery, favorites]);

  const retry = useCallback(async () => {
    await loadInitialRecipes();
  }, [loadInitialRecipes]);

  // Auto-load initial recipes when tags or search query change (if autoLoadInitial is true)
  useEffect(() => {
    if (autoLoadInitial) {
      loadInitialRecipes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags.join(","), searchQuery, favorites, autoLoadInitial]); // Only depend on tags content, not the whole array reference

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    recipes,
    pagination,
    isLoading,
    isLoadingMore,
    error,
    loadInitialRecipes,
    loadMore,
    retry,
  };
}
