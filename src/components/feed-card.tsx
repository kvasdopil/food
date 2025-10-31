"use client";

import { useEffect, useRef } from "react";
import { RecipeFeedCard } from "@/components/recipe-feed-card";
import { useTags } from "@/hooks/useTags";
import { usePaginatedRecipes } from "@/hooks/usePaginatedRecipes";

const chipPalette = [
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
];

export function FeedCard() {
  const { activeTags, removeTag, clearAllTags } = useTags();
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
  } = usePaginatedRecipes({ tags: activeTags, autoLoadInitial: false });

  // Load initial recipes or reload when tags change
  useEffect(() => {
    if (!isLoading) {
      loadInitialRecipes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTags]); // Reload when tags change

  // Container-based infinite scroll (for carousel)
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < 1000 && pagination?.hasMore && !isLoadingMore) {
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

    container.addEventListener("scroll", throttledHandleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", throttledHandleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [pagination?.hasMore, isLoadingMore, loadMore]);

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
        {activeTags.length > 0 && (
          <div className="m-4 flex flex-wrap items-center gap-2 sm:mb-8">
            <span className="text-sm font-medium text-gray-700 sm:text-base"></span>
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
              Clear filters
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
