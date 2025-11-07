"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { RecipeGrid } from "@/components/recipe-grid";
import { ErrorState } from "@/components/error-state";
import { FeedSkeleton } from "@/components/skeletons/feed-skeleton";
import { useTags } from "@/hooks/useTags";
import { usePaginatedRecipes } from "@/hooks/usePaginatedRecipes";
import { useCachedRecipes } from "@/hooks/useCachedRecipes";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

export function FeedPageContent({ initialSeed }: { initialSeed: number }) {
  const searchParams = useSearchParams();
  const { activeTags } = useTags();

  // Get search query from URL
  const searchQuery = searchParams.get("q") || "";
  // Get favorites filter from URL
  const favorites = searchParams.get("favorites") === "true";
  // Check if "mine" tag is active (special tag for filtering by author)
  const hasMineTag = activeTags.includes("mine");

  const { recipes, pagination, isLoading, isLoadingMore, error, loadMore, retry } =
    usePaginatedRecipes({ tags: activeTags, searchQuery, favorites, initialSeed });

  // Get cached recipes and determine what to display
  // Don't use cached recipes when "mine" tag is active (filter should show empty if no results)
  const shouldUseCache = !hasMineTag;
  const { cachedRecipesForLoading, displayRecipes } = useCachedRecipes(
    isLoading,
    recipes,
    shouldUseCache,
  );

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

  // Determine what recipes to display
  const recipesToDisplay = isLoading ? cachedRecipesForLoading || recipes : displayRecipes;
  const hasRecipes = recipesToDisplay.length > 0;

  if (isLoading) {
    return hasRecipes ? <RecipeGrid recipes={recipesToDisplay} /> : <FeedSkeleton count={8} />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={retry} />;
  }

  // Customize empty state message for "My Recipes" filter
  const emptyMessage = hasMineTag ? "You haven't created any recipes yet" : "No recipes found";

  return (
    <>
      {hasRecipes ? (
        <RecipeGrid recipes={recipesToDisplay} />
      ) : (
        <div className="flex items-center justify-center py-32">
          <p className="text-lg text-gray-600">{emptyMessage}</p>
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
