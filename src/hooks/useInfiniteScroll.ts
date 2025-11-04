"use client";

import { useEffect, useRef, type RefObject } from "react";

type UseInfiniteScrollOptions = {
  /**
   * Optional ref to a scrollable container element.
   * If not provided, uses window scroll.
   */
  containerRef?: RefObject<HTMLElement | null>;
  /**
   * Whether there are more items to load
   */
  hasMore: boolean;
  /**
   * Whether a load operation is currently in progress
   */
  isLoading: boolean;
  /**
   * Callback to load more items
   */
  onLoadMore: () => void;
  /**
   * Distance from bottom (in pixels) to trigger load more.
   * Default: 1000
   */
  threshold?: number;
  /**
   * Throttle delay in milliseconds for scroll events.
   * Default: 100
   */
  throttleMs?: number;
};

/**
 * Hook for infinite scroll functionality.
 * Supports both window scrolling and container-based scrolling.
 *
 * @example
 * // Window scrolling
 * useInfiniteScroll({
 *   hasMore: pagination.hasMore,
 *   isLoading: isLoadingMore,
 *   onLoadMore: loadMore,
 * });
 *
 * @example
 * // Container scrolling
 * const containerRef = useRef<HTMLDivElement>(null);
 * useInfiniteScroll({
 *   containerRef,
 *   hasMore: pagination.hasMore,
 *   isLoading: isLoadingMore,
 *   onLoadMore: loadMore,
 * });
 */
export function useInfiniteScroll({
  containerRef,
  hasMore,
  isLoading,
  onLoadMore,
  threshold = 1000,
  throttleMs = 100,
}: UseInfiniteScrollOptions): void {
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const container = containerRef?.current;
    const isWindowScroll = !container;

    const handleScroll = () => {
      // Check if we should load more
      if (!hasMore || isLoading) return;

      let shouldLoadMore = false;

      if (isWindowScroll) {
        // Window scroll: check if near bottom of document
        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        shouldLoadMore = scrollY + windowHeight >= documentHeight - threshold;
      } else {
        // Container scroll: check if near bottom of container
        const { scrollTop, scrollHeight, clientHeight } = container;
        shouldLoadMore = scrollHeight - scrollTop - clientHeight < threshold;
      }

      if (shouldLoadMore) {
        onLoadMore();
      }
    };

    // Throttled scroll handler
    const throttledHandleScroll = () => {
      if (timeoutIdRef.current) return;

      timeoutIdRef.current = setTimeout(() => {
        handleScroll();
        timeoutIdRef.current = null;
      }, throttleMs);
    };

    // Attach scroll listener
    const scrollTarget = isWindowScroll ? window : container;
    scrollTarget.addEventListener("scroll", throttledHandleScroll, { passive: true });

    // Cleanup
    return () => {
      scrollTarget.removeEventListener("scroll", throttledHandleScroll);
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };
  }, [containerRef, hasMore, isLoading, onLoadMore, threshold, throttleMs]);
}
