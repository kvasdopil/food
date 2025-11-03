"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { RecipeSearchBar } from "@/components/recipe-search-bar";
import { useTags } from "@/hooks/useTags";
import { buildFeedUrlWithTagsAndSearch } from "@/lib/tag-utils";

const chipPalette = [
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
];

function FeedLayoutContent({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeTags, removeTag, clearAllTags } = useTags();
  
  // Get search query from URL on mount only
  const urlSearchQuery = searchParams.get("q") || "";
  const [searchQuery, setSearchQuery] = useState(urlSearchQuery);
  const lastUserInputRef = useRef<number>(0); // Track when user last typed
  const previousSearchParamsRef = useRef(urlSearchQuery);

  // Sync from URL only when URL changes externally (browser back/forward, external link, etc.)
  // but not when user is actively typing (within 500ms of last input)
  useEffect(() => {
    const urlQuery = searchParams.get("q") || "";
    const previousQuery = previousSearchParamsRef.current;
    const timeSinceLastInput = Date.now() - lastUserInputRef.current;
    
    // Only sync if:
    // 1. URL changed externally (different from previous)
    // 2. URL is different from current state
    // 3. User hasn't typed recently (more than 500ms ago)
    if (
      urlQuery !== previousQuery && 
      urlQuery !== searchQuery &&
      timeSinceLastInput > 500
    ) {
      // Use setTimeout to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        setSearchQuery(urlQuery);
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
    
    previousSearchParamsRef.current = urlQuery;
  }, [searchParams, searchQuery]);

  // Track when user types
  const handleSearchChange = (value: string) => {
    lastUserInputRef.current = Date.now();
    setSearchQuery(value);
  };

  // Debounce search query and update URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const urlQuery = searchParams.get("q") || "";
      
      // Only update URL if search query actually changed
      if (searchQuery !== urlQuery) {
        // Update URL with search query (preserving tags)
        // Use replace instead of push to avoid creating history entries for every keystroke
        const newUrl = buildFeedUrlWithTagsAndSearch(activeTags, searchQuery);
        router.replace(newUrl);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTags, router, searchParams]);

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl sm:px-6 sm:py-6 lg:px-8">
        <div className="px-4 pt-4 sm:px-0 sm:pt-0">
          <RecipeSearchBar value={searchQuery} onChange={handleSearchChange} />
        </div>
        {activeTags.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2 px-4 sm:mb-8 sm:px-0">
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
        {children}
      </main>
    </div>
  );
}

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <FeedLayoutContent>{children}</FeedLayoutContent>
    </Suspense>
  );
}

