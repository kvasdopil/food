"use client";

import { useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { RecipeGrid } from "@/components/recipe-grid";
import { useTags } from "@/hooks/useTags";
import { usePaginatedRecipes } from "@/hooks/usePaginatedRecipes";
import { useCachedRecipes } from "@/hooks/useCachedRecipes";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { FeedSkeleton } from "@/components/skeletons/feed-skeleton";
import {
  FeedErrorState,
  FeedEmptyState,
  FeedLoadingMore,
  FeedEndState,
} from "@/components/feed-states";

function FeedPageContent() {
  const searchParams = useSearchParams();
  const { activeTags } = useTags();

  // Get search query from URL
  const searchQuery = searchParams.get("q") || "";
  // Get favorites filter from URL
  const favorites = searchParams.get("favorites") === "true";

  const { recipes, pagination, isLoading, isLoadingMore, error, loadMore, retry } =
    usePaginatedRecipes({ tags: activeTags, searchQuery, favorites });

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

  // Determine what recipes to display
  const recipesToDisplay = isLoading ? cachedRecipesForLoading || recipes : displayRecipes;
  const hasRecipes = recipesToDisplay.length > 0;

  if (isLoading) {
    return hasRecipes ? <RecipeGrid recipes={recipesToDisplay} /> : <FeedSkeleton count={8} />;
  }

  if (error) {
    return <FeedErrorState error={error} onRetry={retry} />;
  }

  return (
    <>
      {hasRecipes ? <RecipeGrid recipes={recipesToDisplay} /> : <FeedEmptyState />}
      {isLoadingMore && <FeedLoadingMore />}
      {pagination && !pagination.hasMore && recipes.length > 0 && <FeedEndState />}
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
