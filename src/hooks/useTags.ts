"use client";

import { useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { parseTagsFromUrl, buildFeedUrlWithTags } from "@/lib/tag-utils";

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
   */
  const removeTag = (tagToRemove: string) => {
    const newTags = activeTags.filter((tag) => tag !== tagToRemove);
    router.push(buildFeedUrlWithTags(newTags));
  };

  /**
   * Removes all active tags (clears all filters)
   */
  const clearAllTags = () => {
    router.push("/feed");
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
