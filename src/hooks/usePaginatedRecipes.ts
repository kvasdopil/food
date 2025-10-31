"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type RecipeListItem = {
  slug: string;
  name: string;
  description: string | null;
  tags: string[];
  image_url: string | null;
};

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
  const { tags = [], autoLoadInitial = true } = options;

  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(autoLoadInitial);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingFromSlugRef = useRef<string | null>(null);

  const fetchRecipes = useCallback(
    async (fromSlug?: string, tagsToFetch?: string[], signal?: AbortSignal) => {
      try {
        const params = new URLSearchParams();
        if (fromSlug) {
          params.append("from", fromSlug);
        }
        if (tagsToFetch && tagsToFetch.length > 0) {
          params.append("tags", tagsToFetch.join("+"));
        }
        const queryString = params.toString();
        const url = queryString ? `/api/recipes?${queryString}` : `/api/recipes`;
        const response = await fetch(url, { signal });
        if (!response.ok) {
          throw new Error("Failed to fetch recipes");
        }
        const data: RecipesResponse = await response.json();
        return data;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw err;
        }
        throw err;
      }
    },
    [],
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
      const data = await fetchRecipes(undefined, tags, abortController.signal);

      // Only update if this request wasn't aborted
      if (!abortController.signal.aborted) {
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
  }, [fetchRecipes, tags]);

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
      const data = await fetchRecipes(fromSlug, tags, abortController.signal);

      // Only update if this request wasn't aborted
      if (!abortController.signal.aborted) {
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
  }, [pagination, isLoadingMore, fetchRecipes, recipes, tags]);

  const retry = useCallback(async () => {
    await loadInitialRecipes();
  }, [loadInitialRecipes]);

  // Auto-load initial recipes when tags change (if autoLoadInitial is true)
  useEffect(() => {
    if (autoLoadInitial) {
      loadInitialRecipes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags.join(","), autoLoadInitial]); // Only depend on tags content, not the whole array reference

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
