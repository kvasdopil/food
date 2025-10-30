"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RecipeFeedCard } from "@/components/recipe-feed-card";

type RecipeListItem = {
  slug: string;
  name: string;
  description: string | null;
  tags: string[];
  image_url: string | null;
};

type PaginationInfo = {
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

export function FeedCard() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecipes = useCallback(async (fromSlug?: string) => {
    try {
      const url = fromSlug 
        ? `/api/recipes?from=${encodeURIComponent(fromSlug)}`
        : `/api/recipes`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch recipes");
      }
      const data: RecipesResponse = await response.json();
      return data;
    } catch (err) {
      throw err;
    }
  }, []);

  const loadInitialRecipes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchRecipes();
      setRecipes(data.recipes);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipes");
    } finally {
      setIsLoading(false);
    }
  }, [fetchRecipes]);

  const loadMore = useCallback(async () => {
    if (!pagination || !pagination.hasMore || isLoadingMore || recipes.length === 0) return;

    setIsLoadingMore(true);
    try {
      const lastRecipe = recipes[recipes.length - 1];
      const data = await fetchRecipes(lastRecipe.slug);
      setRecipes((prev) => [...prev, ...data.recipes]);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more recipes");
    } finally {
      setIsLoadingMore(false);
    }
  }, [pagination, isLoadingMore, fetchRecipes, recipes]);

  // Only load if feed hasn't been initialized yet
  useEffect(() => {
    if (recipes.length === 0 && !isLoading) {
      loadInitialRecipes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Container-based infinite scroll (for carousel)
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (
        scrollHeight - scrollTop - clientHeight < 1000 &&
        pagination?.hasMore &&
        !isLoadingMore
      ) {
        loadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [pagination, isLoadingMore, loadMore]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <p className="text-lg text-gray-600">Loading recipes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-lg text-red-600">{error}</p>
          <button
            onClick={loadInitialRecipes}
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto bg-white">
      <main className="mx-auto max-w-7xl sm:px-6 sm:py-6 lg:px-8">
        {recipes.length === 0 ? (
          <div className="flex items-center justify-center py-32">
            <p className="text-lg text-gray-600">No recipes found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {recipes.map((recipe) => (
              <RecipeFeedCard
                key={recipe.slug}
                slug={recipe.slug}
                name={recipe.name}
                description={recipe.description}
                tags={recipe.tags}
                imageUrl={recipe.image_url}
              />
            ))}
          </div>
        )}
      </main>

      {isLoadingMore && (
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-gray-600">Loading more recipes...</p>
        </div>
      )}

      {pagination && !pagination.hasMore && recipes.length > 0 && (
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-gray-600">No more recipes to load</p>
        </div>
      )}
    </div>
  );
}

