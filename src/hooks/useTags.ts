"use client";

import { useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { parseTagsFromUrl, buildFeedUrlWithTagsAndSearch } from "@/lib/tag-utils";

/**
 * Hook for managing tags in the feed context
 */
export function useTags() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse active tags from URL
  const activeTags = useMemo(() => {
    return parseTagsFromUrl(searchParams);
  }, [searchParams]);

  /**
   * Removes a tag from the active filters
   * Preserves search query in URL
   */
  const removeTag = (tagToRemove: string) => {
    const newTags = activeTags.filter((tag) => tag !== tagToRemove);
    const searchQuery = searchParams.get("q") || "";
    router.push(buildFeedUrlWithTagsAndSearch(newTags, searchQuery));
  };

  /**
   * Removes all active tags (clears all filters)
   * Preserves search query in URL
   */
  const clearAllTags = () => {
    const searchQuery = searchParams.get("q") || "";
    router.push(buildFeedUrlWithTagsAndSearch([], searchQuery));
  };

  /**
   * Checks if a tag is currently active
   */
  const isTagActive = (tag: string): boolean => {
    return activeTags.includes(tag.toLowerCase());
  };

  return {
    activeTags,
    removeTag,
    clearAllTags,
    isTagActive,
  };
}
