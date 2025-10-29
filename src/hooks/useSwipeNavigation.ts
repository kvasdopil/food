"use client";

import { useEffect, useRef } from "react";

import { useRecipePreload } from "@/components/recipe-preload-provider";
import { fetchRandomSlug } from "@/lib/random-recipe";

const TOUCH_THRESHOLD = 60;

export function useSwipeNavigation({
  currentSlug,
  onNavigateNext,
  onNavigatePrevious,
}: {
  currentSlug: string;
  onNavigateNext: (slug: string) => Promise<void>;
  onNavigatePrevious: () => Promise<void>;
}) {
  const { getNextSlug } = useRecipePreload();
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    function handleTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
    }

    async function handleTouchEnd(event: TouchEvent) {
      if (busyRef.current) return;
      if (touchStartX.current === null || touchStartY.current === null) return;
      if (event.changedTouches.length !== 1) return;

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = touch.clientY - touchStartY.current;

      touchStartX.current = null;
      touchStartY.current = null;

      if (Math.abs(deltaX) < TOUCH_THRESHOLD) return;
      if (Math.abs(deltaX) < Math.abs(deltaY)) return;

      busyRef.current = true;
      try {
        if (deltaX > 0) {
          await onNavigatePrevious();
        } else {
          try {
            const slug = await getNextSlug();
            await onNavigateNext(slug);
          } catch (prefetchError) {
            console.error("Swipe navigation fallback:", prefetchError);
            const slug = await fetchRandomSlug(currentSlug);
            await onNavigateNext(slug);
          }
        }
      } finally {
        busyRef.current = false;
      }
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [currentSlug, getNextSlug, onNavigateNext, onNavigatePrevious]);
}
