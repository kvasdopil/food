"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { RecipeFeedCard } from "@/components/recipe-feed-card";
import { useTags } from "@/hooks/useTags";
import { usePaginatedRecipes } from "@/hooks/usePaginatedRecipes";
import { useCachedRecipes } from "@/hooks/useCachedRecipes";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { FeedSkeleton } from "@/components/skeletons/feed-skeleton";
import { RECIPE_GRID_CLASSES } from "@/lib/ui-constants";

export function FeedCard() {
  const searchParams = useSearchParams();
  const { activeTags } = useTags();

  // Get search query from URL
  const searchQuery = searchParams.get("q") || "";
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    recipes,
    pagination,
    isLoading,
    isLoadingMore,
    error,
    loadInitialRecipes,
    loadMore,
    retry,
  } = usePaginatedRecipes({ tags: activeTags, searchQuery, autoLoadInitial: false });

  // Get cached recipes and determine what to display
  const { cachedRecipesForLoading, displayRecipes } = useCachedRecipes(isLoading, recipes);

  // Load initial recipes or reload when tags or search query change
  useEffect(() => {
    if (!isLoading) {
      loadInitialRecipes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTags, searchQuery]); // Reload when tags or search query change

  // Container-based infinite scroll (for carousel)
  useInfiniteScroll({
    containerRef: scrollRef,
    hasMore: pagination?.hasMore ?? false,
    isLoading: isLoadingMore,
    onLoadMore: loadMore,
    threshold: 1000,
    throttleMs: 100,
  });

  if (isLoading) {
    // If we have cached recipes to show, display them instead of skeletons
    const displayRecipes = cachedRecipesForLoading || recipes;

    return (
      <div className="h-full overflow-y-auto bg-white">
        <main className="mx-auto max-w-7xl sm:px-6 sm:py-6 lg:px-8">
          {displayRecipes.length > 0 ? (
            <div className={RECIPE_GRID_CLASSES}>
              {displayRecipes.map((recipe) => (
                <RecipeFeedCard
                  key={recipe.slug}
                  slug={recipe.slug}
                  name={recipe.name}
                  description={recipe.description}
                  tags={recipe.tags}
                  imageUrl={recipe.image_url}
                  prepTimeMinutes={recipe.prep_time_minutes}
                  cookTimeMinutes={recipe.cook_time_minutes}
                />
              ))}
            </div>
          ) : (
            <FeedSkeleton count={8} />
          )}
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-lg text-red-600">{error}</p>
          <button
            onClick={retry}
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
        {displayRecipes.length === 0 && !isLoading ? (
          <div className="flex items-center justify-center py-32">
            <p className="text-lg text-gray-600">No recipes found</p>
          </div>
        ) : (
          <div className={RECIPE_GRID_CLASSES}>
            {displayRecipes.map((recipe) => (
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
        <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <FeedSkeleton count={4} />
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
