"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SwipeableCarousel } from "@/components/swipeable-carousel";
import { Recipe } from "@/components/recipe/recipe";
import { fetchRandomSlug } from "@/lib/random-recipe";
import {
  getPreviousSlug,
  moveHistoryBackward,
  pushSlugOntoHistory,
  syncHistoryWithCurrentSlug,
  type RecipeHistorySnapshot,
  getCurrentSlug,
  getNextSlugFromHistory,
} from "./recipe-history";

type RecipeSwipeableCarouselProps = {
  slug: string;
};

type CarouselSnapshot = {
  current: string;
  next: string | null;
  previous: string | null;
};

let lastSnapshot: CarouselSnapshot | null = null;

function getInitialSnapshot(slug: string, historySnapshot: RecipeHistorySnapshot | null): CarouselSnapshot {
  if (lastSnapshot?.current === slug) {
    return lastSnapshot;
  }

  return {
    current: slug,
    next: null,
    previous: getPreviousSlug(historySnapshot),
  };
}

export function RecipeSwipeableCarousel({ slug }: RecipeSwipeableCarouselProps) {
  const router = useRouter();
  const initialSnapshotRef = useRef<CarouselSnapshot | null>(null);
  const historySnapshotRef = useRef<RecipeHistorySnapshot | null>(null);

  if (initialSnapshotRef.current === null) {
    const historySnapshot = typeof window !== "undefined" ? syncHistoryWithCurrentSlug(slug) : null;
    historySnapshotRef.current = historySnapshot;
    initialSnapshotRef.current = getInitialSnapshot(slug, historySnapshot);
  }

  const initialSnapshot = initialSnapshotRef.current;

  const [currentSlug, setCurrentSlug] = useState<string>(initialSnapshot.current);
  const [nextSlug, setNextSlug] = useState<string | null>(initialSnapshot.next);
  const [previousSlug, setPreviousSlug] = useState<string | null>(initialSnapshot.previous);

  useEffect(() => {
    console.log("[carousel] state update", { currentSlug, nextSlug, previousSlug });
    lastSnapshot = {
      current: currentSlug,
      next: nextSlug,
      previous: previousSlug,
    };
  }, [currentSlug, nextSlug, previousSlug]);

  // Create carousel items array (just slugs)
  const carouselItems: string[] = [
    previousSlug && previousSlug !== currentSlug ? previousSlug : null,
    currentSlug,
    nextSlug && nextSlug !== currentSlug && nextSlug !== previousSlug ? nextSlug : null,
  ].filter(Boolean) as string[];
  useEffect(() => {
    console.log("[carousel] items", { carouselItems, currentSlug, nextSlug, previousSlug });
  }, [carouselItems, currentSlug, nextSlug, previousSlug]);
  const currentIndex = (() => {
    const index = carouselItems.findIndex((item) => item === currentSlug);
    return index === -1 ? 0 : index;
  })();

  // Load next recipe slug
  const loadNextSlug = useCallback(async () => {
    if (!currentSlug) return;

    // Don't load if we already have a next slug
    if (nextSlug) return;

    // Check if there's forward history available (no need to call API)
    const snapshot = historySnapshotRef.current ?? (typeof window !== "undefined"
      ? syncHistoryWithCurrentSlug(currentSlug)
      : null);
    
    const forwardSlug = getNextSlugFromHistory(snapshot);
    if (forwardSlug) {
      console.log("[carousel] Using forward history instead of API call", forwardSlug);
      setNextSlug(forwardSlug);
      return;
    }

    // Only call API when there's no forward history
    try {
      const slug = await fetchRandomSlug(currentSlug);
      setNextSlug(slug);
    } catch (error) {
      console.error("Failed to load next recipe slug:", error);
    }
  }, [currentSlug, nextSlug]);


  // Update current slug when prop changes (external navigation)
  useEffect(() => {
    setCurrentSlug((prev) => {
      if (prev === slug) {
        return prev;
      }

      setNextSlug(null);
      return slug;
    });
  }, [slug]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const historySnapshot = syncHistoryWithCurrentSlug(slug);
    historySnapshotRef.current = historySnapshot;
    setPreviousSlug(getPreviousSlug(historySnapshot));
  }, [slug]);

  // Preload next slug when current slug is available
  useEffect(() => {
    if (currentSlug) {
      loadNextSlug();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlug]);

  const handleNavigate = useCallback(async (direction: "next" | "previous") => {
    console.log("[carousel] handleNavigate", { direction, currentSlug, nextSlug, previousSlug });
    if (!currentSlug) return;

    if (direction === "next") {
      // Check forward history first, then nextSlug state, then API
      let snapshot = historySnapshotRef.current ?? (typeof window !== "undefined"
        ? syncHistoryWithCurrentSlug(currentSlug)
        : null);
      const forwardSlug = getNextSlugFromHistory(snapshot);
      const targetSlug = forwardSlug || nextSlug || (await fetchRandomSlug(currentSlug));
      if (targetSlug) {
        // Re-sync snapshot in case it changed
        snapshot = historySnapshotRef.current ?? (typeof window !== "undefined"
          ? syncHistoryWithCurrentSlug(currentSlug)
          : null);
        const updatedSnapshot = snapshot ? pushSlugOntoHistory(snapshot, targetSlug) : null;
        if (updatedSnapshot) {
          historySnapshotRef.current = updatedSnapshot;
          setPreviousSlug(getPreviousSlug(updatedSnapshot));
          lastSnapshot = {
            current: targetSlug,
            previous: getPreviousSlug(updatedSnapshot),
            next: null,
          };
        } else {
          setPreviousSlug(currentSlug);
          lastSnapshot = {
            current: targetSlug,
            previous: currentSlug,
            next: null,
          };
        }
        setCurrentSlug(targetSlug);
        setNextSlug(null);
        router.push(`/recipes/${targetSlug}`, { scroll: false });
        // Wait for React to process the state update
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        // loadNextSlug() will be called by the useEffect when currentSlug changes
      }
    } else if (direction === "previous") {
      if (previousSlug) {
        const snapshot = historySnapshotRef.current ?? (typeof window !== "undefined"
          ? syncHistoryWithCurrentSlug(currentSlug)
          : null);
        const movedSnapshot = snapshot ? moveHistoryBackward(snapshot) : null;
        const targetSlug = movedSnapshot ? getCurrentSlug(movedSnapshot) : null;
        if (!movedSnapshot || !targetSlug) {
          return;
        }

        historySnapshotRef.current = movedSnapshot;
        console.log("[carousel] previous resolved", {
          targetSlug,
          movedSnapshot,
          currentSlug,
          previousSlug,
          historyPrevious: getPreviousSlug(movedSnapshot),
        });
        setNextSlug(currentSlug);
        setCurrentSlug(targetSlug);
        const historyPrevious = getPreviousSlug(movedSnapshot);
        setPreviousSlug(historyPrevious);
        lastSnapshot = {
          current: targetSlug,
          previous: historyPrevious,
          next: currentSlug,
        };
        router.back();
        // Wait for React to process the state update
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
  }, [currentSlug, nextSlug, previousSlug, router]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderRecipeItem = useCallback((slug: string, _isActive: boolean) => {
    return <Recipe slug={slug} />;
  }, []);

  return (
    <SwipeableCarousel
      items={carouselItems}
      currentIndex={currentIndex}
      onNavigate={handleNavigate}
      renderItem={renderRecipeItem}
      disablePrevious={!previousSlug}
    />
  );
}
