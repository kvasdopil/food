"use client";

import { useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { RecipeFeedCard } from "@/components/recipe-feed-card";
import { useTags } from "@/hooks/useTags";
import { usePaginatedRecipes } from "@/hooks/usePaginatedRecipes";
import { useCachedRecipes } from "@/hooks/useCachedRecipes";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { FeedSkeleton } from "@/components/skeletons/feed-skeleton";
import { RECIPE_GRID_CLASSES } from "@/lib/ui-constants";

function FeedPageContent() {
  const searchParams = useSearchParams();
  const { activeTags } = useTags();

  // Get search query from URL
  const searchQuery = searchParams.get("q") || "";

  const { recipes, pagination, isLoading, isLoadingMore, error, loadMore, retry } =
    usePaginatedRecipes({ tags: activeTags, searchQuery });

  // Get cached recipes and determine what to display
  const { cachedRecipesForLoading, displayRecipes } = useCachedRecipes(isLoading, recipes);

  // Scroll to top only when tags change (user action)
  // Don't scroll on search query changes to avoid interrupting user scrolling
  const activeTagsKey = activeTags.join(",");
  const prevTagsRef = useRef(activeTagsKey);

  useEffect(() => {
    // Only scroll to top if tags actually changed (not on initial mount)
    const tagsChanged = prevTagsRef.current !== activeTagsKey;

    if (tagsChanged && prevTagsRef.current !== "") {
      window.scrollTo(0, 0);
    }

    prevTagsRef.current = activeTagsKey;
  }, [activeTagsKey]);

  // Infinite scroll
  useInfiniteScroll({
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
      <>
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
      </>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-32">
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
    <>
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
              prepTimeMinutes={recipe.prep_time_minutes}
              cookTimeMinutes={recipe.cook_time_minutes}
            />
          ))}
        </div>
      )}

      {isLoadingMore && (
        <div className="mt-6">
          <FeedSkeleton count={4} />
        </div>
      )}

      {pagination && !pagination.hasMore && recipes.length > 0 && (
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-gray-600">No more recipes</p>
        </div>
      )}
    </>
  );
}

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white">
          <main className="mx-auto max-w-7xl sm:px-6 sm:py-6 lg:px-8">
            <FeedSkeleton count={8} />
          </main>
        </div>
      }
    >
      <FeedPageContent />
    </Suspense>
  );
}
