"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { buildFeedUrlWithTagsAndSearch } from "@/lib/tag-utils";

type UseSearchQueryOptions = {
  tags?: string[];
  debounceMs?: number;
  syncThresholdMs?: number;
};

/**
 * Hook for managing search query synchronization with URL
 * Handles debouncing, URL sync, and external URL changes (browser back/forward)
 */
export function useSearchQuery(options: UseSearchQueryOptions = {}) {
  const { tags = [], debounceMs = 300, syncThresholdMs = 500 } = options;
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get initial query from URL
  const urlQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(urlQuery);

  // Track when user last typed to prevent sync conflicts
  const lastUserInputRef = useRef<number>(0);
  const previousUrlQueryRef = useRef(urlQuery);

  // Sync from URL when URL changes externally (browser back/forward, external link, etc.)
  // but not when user is actively typing
  useEffect(() => {
    const currentUrlQuery = searchParams.get("q") || "";
    const previousUrlQuery = previousUrlQueryRef.current;
    const timeSinceLastInput = Date.now() - lastUserInputRef.current;

    // Only sync if:
    // 1. URL changed externally (different from previous)
    // 2. URL is different from current state
    // 3. User hasn't typed recently (more than syncThresholdMs ago)
    if (
      currentUrlQuery !== previousUrlQuery &&
      currentUrlQuery !== query &&
      timeSinceLastInput > syncThresholdMs
    ) {
      // Use setTimeout to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        setQuery(currentUrlQuery);
      }, 0);

      previousUrlQueryRef.current = currentUrlQuery;
      return () => clearTimeout(timeoutId);
    }

    previousUrlQueryRef.current = currentUrlQuery;
  }, [searchParams, query, syncThresholdMs]);

  // Track when user types
  const handleQueryChange = useCallback(
    (value: string) => {
      lastUserInputRef.current = Date.now();
      setQuery(value);
    },
    [],
  );

  // Debounce search query and update URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentUrlQuery = searchParams.get("q") || "";

      // Only update URL if search query actually changed
      if (query !== currentUrlQuery) {
        // Update URL with search query (preserving tags)
        // Use replace instead of push to avoid creating history entries for every keystroke
        const newUrl = buildFeedUrlWithTagsAndSearch(tags, query);
        router.replace(newUrl);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, tags, router, searchParams, debounceMs]);

  return {
    query,
    setQuery: handleQueryChange,
    urlQuery,
  };
}

