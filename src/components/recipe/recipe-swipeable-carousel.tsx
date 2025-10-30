"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

import { SwipeableCarousel } from "../swipeable-carousel";
import { Recipe } from "./recipe";
import { fetchRandomSlug } from "@/lib/random-recipe";

type RecipeSwipeableCarouselProps = {
  slug: string;
};

export function RecipeSwipeableCarousel({ slug }: RecipeSwipeableCarouselProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentSlug, setCurrentSlug] = useState<string>(slug);
  const [nextSlug, setNextSlug] = useState<string | null>(null);
  const [previousSlug, setPreviousSlug] = useState<string | null>(null);

  // Create carousel items array (just slugs)
  const carouselItems: string[] = [previousSlug, currentSlug, nextSlug].filter(Boolean) as string[];
  const currentIndex = carouselItems.findIndex(item => item === currentSlug);

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

  // Load previous recipe slug
  const loadPreviousSlug = useCallback(async () => {
    if (!currentSlug) return;

    // Don't load if we already have a previous slug
    if (previousSlug) return;

    try {
      // For previous, we'll use a random recipe as fallback
      // In a real app, you might want to track navigation history
      const slug = await fetchRandomSlug(currentSlug);
      setPreviousSlug(slug);
    } catch (error) {
      console.error("Failed to load previous recipe slug:", error);
    }
  }, [currentSlug, previousSlug]);

  // Update current slug when prop changes
  useEffect(() => {
    setCurrentSlug(slug);
    setNextSlug(null);
    setPreviousSlug(null);
  }, [slug]);

  // Update when pathname changes (external navigation)
  useEffect(() => {
    if (pathname !== `/recipes/${currentSlug}`) {
      // Reset state when navigating externally
      setNextSlug(null);
      setPreviousSlug(null);
    }
  }, [pathname, currentSlug]);

  // Preload next and previous slugs when current slug is available
  useEffect(() => {
    if (currentSlug) {
      loadNextSlug();
      loadPreviousSlug();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlug]);

  // Log rendered cards and current route
  useEffect(() => {
    const cards = [];
    if (currentSlug) cards.push(`current: ${currentSlug}`);
    if (previousSlug) cards.push(`previous: ${previousSlug}`);
    if (nextSlug) cards.push(`next: ${nextSlug}`);
    console.log("Rendered cards:", cards.join(", "), "| Route:", pathname);
  }, [currentSlug, previousSlug, nextSlug, pathname]);

  const handleNavigate = useCallback(async (direction: "next" | "previous") => {
    if (!currentSlug) return;

    if (direction === "next") {
      const targetSlug = nextSlug || await fetchRandomSlug(currentSlug);
      if (targetSlug) {
        // Hide underlying recipes during transition
        setPreviousSlug(null);
        setNextSlug(null);
        // Update current slug
        setCurrentSlug(targetSlug);
        router.replace(`/recipes/${targetSlug}`, { scroll: false });
        // Wait for React to process the state update
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        // loadNextSlug() will be called by the useEffect when currentSlug changes
      }
    } else if (direction === "previous") {
      const targetSlug = previousSlug || await fetchRandomSlug(currentSlug);
      if (targetSlug) {
        // Hide underlying recipes during transition
        setNextSlug(null);
        setPreviousSlug(null);
        // Update current slug
        setCurrentSlug(targetSlug);
        router.replace(`/recipes/${targetSlug}`, { scroll: false });
        // Wait for React to process the state update
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        // loadPreviousSlug() will be called by the useEffect when currentSlug changes
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
    />
  );
}
