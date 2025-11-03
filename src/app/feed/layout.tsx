"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { RecipeSearchBar } from "@/components/recipe-search-bar";
import { useTags } from "@/hooks/useTags";
import { buildFeedUrlWithTagsAndSearch, storeFeedUrl } from "@/lib/tag-utils";

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

  // Store current feed URL in sessionStorage to preserve filters when navigating to recipes
  useEffect(() => {
    storeFeedUrl();
  }, [searchParams]); // Update whenever URL params change

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl sm:px-6 sm:py-6 lg:px-8">
        <div className="px-4 pt-4 sm:px-0 sm:pt-0">
          <RecipeSearchBar 
            value={searchQuery} 
            onChange={handleSearchChange}
            activeTags={activeTags}
            onRemoveTag={removeTag}
            onClearAllTags={clearAllTags}
          />
        </div>
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

