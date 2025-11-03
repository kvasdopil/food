"use client";

import { useEffect, Suspense, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { RecipeFeedCard } from "@/components/recipe-feed-card";
import { useTags } from "@/hooks/useTags";
import { usePaginatedRecipes } from "@/hooks/usePaginatedRecipes";
import { FeedSkeleton } from "@/components/skeletons/feed-skeleton";
import { recipeStore } from "@/lib/recipe-store";

function FeedPageContent() {
  const searchParams = useSearchParams();
  const { activeTags } = useTags();

  // Get search query from URL
  const searchQuery = searchParams.get("q") || "";

  const { recipes, pagination, isLoading, isLoadingMore, error, loadMore, retry } =
    usePaginatedRecipes({ tags: activeTags, searchQuery });

  // Get all cached recipes from IndexedDB to show immediately on load
  const allCachedRecipes = useMemo(() => {
    // Get all cached partial recipes from store (loaded from IndexedDB)
    const cached = recipeStore.getAllPartials();
    if (cached.length === 0) return null;

    // Convert to RecipeListItem format
    // Note: Cached partial data doesn't include time fields, so they'll be null
    return cached.map((partial) => ({
      slug: partial.slug,
      name: partial.name,
      description: partial.description,
      tags: partial.tags,
      image_url: partial.image_url,
      prep_time_minutes: null,
      cook_time_minutes: null,
    }));
  }, []); // Only compute once on mount

  // When loading, try to show cached recipes from previous loads
  const cachedRecipesForLoading = useMemo(() => {
    // If we have cached recipes and no current recipes yet, show cached ones
    if (isLoading && recipes.length === 0 && allCachedRecipes) {
      return allCachedRecipes;
    }

    if (!isLoading || recipes.length === 0) return null;

    // Get cached partial data for the recipes we've already loaded
    // This allows showing cached data while refreshing
    return recipes
      .map((recipe) => {
        const cached = recipeStore.getPartial(recipe.slug);
        return cached ? { ...recipe, ...cached } : recipe;
      })
      .filter(Boolean);
  }, [isLoading, recipes, allCachedRecipes]);

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

    // Throttle scroll events to avoid excessive calls
    let timeoutId: NodeJS.Timeout | null = null;
    const throttledHandleScroll = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        handleScroll();
        timeoutId = null;
      }, 100);
    };

    window.addEventListener("scroll", throttledHandleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", throttledHandleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [pagination?.hasMore, isLoadingMore, loadMore]);

  if (isLoading) {
    // If we have cached recipes to show, display them instead of skeletons
    const displayRecipes = cachedRecipesForLoading || recipes;

    return (
      <>
        {displayRecipes.length > 0 ? (
          <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
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

  // Determine which recipes to display - use cached if no recipes loaded yet
  const displayRecipes = recipes.length > 0 ? recipes : allCachedRecipes || [];

  return (
    <>
      {displayRecipes.length === 0 && !isLoading ? (
        <div className="flex items-center justify-center py-32">
          <p className="text-lg text-gray-600">No recipes found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
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
