"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SwipeableCarousel } from "@/components/swipeable-carousel";
import { Recipe } from "@/components/recipe/recipe";
import { fetchRandomSlug } from "@/lib/random-recipe";

type RecipeSwipeableCarouselProps = {
  slug: string;
};

type CarouselSnapshot = {
  current: string;
  next: string | null;
  previous: string | null;
};

let lastSnapshot: CarouselSnapshot | null = null;

function getInitialSnapshot(slug: string): CarouselSnapshot {
  if (lastSnapshot?.current === slug) {
    return lastSnapshot;
  }

  return {
    current: slug,
    next: null,
    previous: null,
  };
}

export function RecipeSwipeableCarousel({ slug }: RecipeSwipeableCarouselProps) {
  const router = useRouter();
  const initialSnapshotRef = useRef<CarouselSnapshot | null>(null);

  if (initialSnapshotRef.current === null) {
    initialSnapshotRef.current = getInitialSnapshot(slug);
  }

  const initialSnapshot = initialSnapshotRef.current;

  const [currentSlug, setCurrentSlug] = useState<string>(initialSnapshot.current);
  const [nextSlug, setNextSlug] = useState<string | null>(initialSnapshot.next);
  const [previousSlug, setPreviousSlug] = useState<string | null>(initialSnapshot.previous);

  useEffect(() => {
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
  const currentIndex = (() => {
    const index = carouselItems.findIndex((item) => item === currentSlug);
    return index === -1 ? 0 : index;
  })();

  // Load next recipe slug
  const loadNextSlug = useCallback(async () => {
    if (!currentSlug) return;

    // Don't load if we already have a next slug
    if (nextSlug) return;

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
      setPreviousSlug(null);
      return slug;
    });
  }, [slug]);

  // Preload next slug when current slug is available
  useEffect(() => {
    if (currentSlug) {
      loadNextSlug();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlug]);

  const handleNavigate = useCallback(async (direction: "next" | "previous") => {
    if (!currentSlug) return;

    if (direction === "next") {
      const targetSlug = nextSlug || (await fetchRandomSlug(currentSlug));
      if (targetSlug) {
        setPreviousSlug(currentSlug);
        setCurrentSlug(targetSlug);
        setNextSlug(null);
        lastSnapshot = {
          current: targetSlug,
          previous: currentSlug,
          next: null,
        };
        router.replace(`/recipes/${targetSlug}`, { scroll: false });
        // Wait for React to process the state update
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        // loadNextSlug() will be called by the useEffect when currentSlug changes
      }
    } else if (direction === "previous") {
      if (previousSlug) {
        setNextSlug(currentSlug);
        setCurrentSlug(previousSlug);
        setPreviousSlug(null);
        lastSnapshot = {
          current: previousSlug,
          previous: null,
          next: currentSlug,
        };
        router.replace(`/recipes/${previousSlug}`, { scroll: false });
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
      disablePrevious={!document.referrer || new URL(document.referrer).origin !== window.location.origin}
    />
  );
}
