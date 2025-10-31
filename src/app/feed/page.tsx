"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { RecipeFeedCard } from "@/components/recipe-feed-card";
import { useTags } from "@/hooks/useTags";

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

const chipPalette = [
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
];

function FeedPageContent() {
  const { activeTags, removeTag, clearAllTags } = useTags();
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debug: Log activeTags to see if they're being parsed correctly
  useEffect(() => {
    console.log("[FeedPageContent] activeTags:", activeTags);
  }, [activeTags]);

  const fetchRecipes = useCallback(async (fromSlug?: string, tags?: string[]) => {
    try {
      const params = new URLSearchParams();
      if (fromSlug) {
        params.append("from", fromSlug);
      }
      if (tags && tags.length > 0) {
        params.append("tags", tags.join("+"));
      }
      const queryString = params.toString();
      const url = queryString ? `/api/recipes?${queryString}` : `/api/recipes`;
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
      const data = await fetchRecipes(undefined, activeTags);
      setRecipes(data.recipes);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipes");
    } finally {
      setIsLoading(false);
    }
  }, [fetchRecipes, activeTags]);

  const loadMore = useCallback(async () => {
    if (!pagination || !pagination.hasMore || isLoadingMore || recipes.length === 0) return;

    setIsLoadingMore(true);
    try {
      // Use the slug of the last recipe in the current list for pagination
      const lastRecipe = recipes[recipes.length - 1];
      const data = await fetchRecipes(lastRecipe.slug, activeTags);
      setRecipes((prev) => [...prev, ...data.recipes]);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more recipes");
    } finally {
      setIsLoadingMore(false);
    }
  }, [pagination, isLoadingMore, fetchRecipes, recipes, activeTags]);

  useEffect(() => {
    loadInitialRecipes();
    // Scroll to top when tags change
    window.scrollTo(0, 0);
  }, [loadInitialRecipes]);

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1000 &&
        pagination?.hasMore &&
        !isLoadingMore
      ) {
        loadMore();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pagination, isLoadingMore, loadMore]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-lg text-gray-600">Loading recipes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
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
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl sm:px-6 sm:py-6 lg:px-8">
        {activeTags.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2 sm:mb-8">
            <span className="text-sm font-medium text-gray-700 sm:text-base">Filtered by:</span>
            {activeTags.map((tag, index) => (
              <button
                key={tag}
                type="button"
                onClick={() => removeTag(tag)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition hover:opacity-80 ${chipPalette[index % chipPalette.length]}`}
              >
                {tag}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            ))}
            <button
              type="button"
              onClick={clearAllTags}
              className="ml-2 text-sm font-medium text-gray-600 underline transition hover:text-gray-800"
            >
              Clear all
            </button>
          </div>
        )}
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
          <p className="text-sm text-gray-600">No more recipes</p>
        </div>
      )}
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <p className="text-lg text-gray-600">Loading recipes...</p>
        </div>
      }
    >
      <FeedPageContent />
    </Suspense>
  );
}
