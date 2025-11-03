"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FiChevronLeft } from "react-icons/fi";
import { SwipeableCarousel } from "@/components/swipeable-carousel";
import { FeedCard } from "@/components/feed-card";
import { Recipe } from "@/components/recipe/recipe";
import { fetchRandomSlug } from "@/lib/random-recipe";
import {
  moveHistoryBackward,
  pushSlugOntoHistory,
  syncHistoryWithCurrentSlug,
  type RecipeHistorySnapshot,
  getNextSlugFromHistory,
} from "@/app/recipes/[slug]/client/recipe-history";

type CarouselItem = { type: "feed"; id: "feed" } | { type: "recipe"; slug: string; id: string };

type CarouselSnapshot = {
  currentIndex: number;
  items: CarouselItem[];
};

let lastSnapshot: CarouselSnapshot | null = null;

function getInitialSnapshot(pathname: string): CarouselSnapshot {
  // If we're coming back to the same state, reuse it
  if (lastSnapshot) {
    return lastSnapshot;
  }

  const items: CarouselItem[] = [{ type: "feed", id: "feed" }];

  // Extract slug from pathname
  const match = pathname?.match(/^\/recipes\/([^/]+)/);
  const slug = match?.[1];

  if (slug) {
    // User is on a recipe page
    items.push({ type: "recipe", slug, id: `recipe-${slug}` });
    return {
      currentIndex: 1,
      items,
    };
  } else {
    // User is on feed
    return {
      currentIndex: 0,
      items,
    };
  }
}

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 640; // sm breakpoint
}

export function MobileCarouselWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  const initialSnapshotRef = useRef<CarouselSnapshot | null>(null);
  const historySnapshotRef = useRef<RecipeHistorySnapshot | null>(null);
  const isInternalNavigationRef = useRef(false);
  const lastPathnameRef = useRef<string | null>(null);
  const itemsRef = useRef<CarouselItem[]>([]);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobileDevice(isMobile());
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Initialize snapshot - move to useEffect to avoid accessing refs during render
  const [currentIndex, setCurrentIndexState] = useState(0);
  const [items, setItems] = useState<CarouselItem[]>(() => {
    // Initialize with default - will be updated in useEffect
    return [{ type: "feed", id: "feed" }];
  });

  // Initialize snapshot once on mount
  useEffect(() => {
    if (initialSnapshotRef.current === null && typeof window !== "undefined") {
      const slug = pathname?.match(/^\/recipes\/([^/]+)/)?.[1] || "";
      const historySnapshot = syncHistoryWithCurrentSlug(slug);
      historySnapshotRef.current = historySnapshot;
      initialSnapshotRef.current = getInitialSnapshot(pathname || "");
      lastPathnameRef.current = pathname || null;

      // Set initial state
      const snapshot = initialSnapshotRef.current;
      setCurrentIndexState(snapshot.currentIndex);
      setItems(snapshot.items);
      itemsRef.current = snapshot.items;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Keep itemsRef in sync with items
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Helper to set current index and update URL if needed
  const setCurrentIndex = useCallback(
    (newIndex: number, skipUrlUpdate = false) => {
      setCurrentIndexState(newIndex);

      if (skipUrlUpdate) return;

      // Use ref to get latest items
      const currentItems = itemsRef.current;
      const newItem = currentItems[newIndex];
      if (!newItem) return;

      const expectedPath = newItem.type === "feed" ? "/feed" : `/recipes/${newItem.slug}`;

      // Only update URL if it doesn't match
      if (pathname !== expectedPath) {
        isInternalNavigationRef.current = true;
        router.push(expectedPath, { scroll: false });
      }
    },
    [pathname, router],
  );

  // Update snapshot when pathname changes externally (user clicks link, browser back, etc.)
  useEffect(() => {
    // Skip if this is the same pathname (prevent re-processing)
    if (pathname === lastPathnameRef.current) {
      return;
    }

    // Skip if this was an internal navigation (carousel update)
    if (isInternalNavigationRef.current) {
      isInternalNavigationRef.current = false;
      lastPathnameRef.current = pathname;
      return;
    }

    lastPathnameRef.current = pathname;

    const match = pathname?.match(/^\/recipes\/([^/]+)/);
    const slug = match?.[1];

    if (slug) {
      // Update history
      const historySnapshot = syncHistoryWithCurrentSlug(slug);
      historySnapshotRef.current = historySnapshot;

      // Update carousel items and index
      setItems((prev) => {
        const recipeIndex = prev.findIndex((item) => item.type === "recipe" && item.slug === slug);

        if (recipeIndex !== -1) {
          // Recipe already in carousel
          setCurrentIndex(recipeIndex, true); // Skip URL update since pathname already changed
          return prev;
        } else {
          // Add new recipe
          const newItems = [...prev];
          newItems.push({ type: "recipe", slug, id: `recipe-${slug}` });
          setCurrentIndex(newItems.length - 1, true); // Skip URL update since pathname already changed
          return newItems;
        }
      });
    } else if (pathname === "/feed") {
      // Navigated to feed - clean up carousel to only have feed
      // This ensures a fresh start when navigating from feed to a new recipe
      setItems([{ type: "feed", id: "feed" }]);
      setCurrentIndex(0, true); // Skip URL update since pathname already changed
    }
  }, [pathname, setCurrentIndex]);

  // Preload next recipe - returns slug if loaded
  const loadNextRecipe = useCallback(async (): Promise<string | null> => {
    const currentItem = items[currentIndex];
    if (currentItem?.type !== "recipe") return null;

    // Check if next recipe already exists
    if (currentIndex < items.length - 1) {
      const nextItem = items[currentIndex + 1];
      if (nextItem?.type === "recipe") {
        return nextItem.slug; // Already loaded
      }
    }

    // Check forward history first
    const snapshot = historySnapshotRef.current;
    const forwardSlug = getNextSlugFromHistory(snapshot);
    if (forwardSlug) {
      setItems((prev) => {
        if (prev.some((item) => item.type === "recipe" && item.slug === forwardSlug)) {
          return prev;
        }
        return [...prev, { type: "recipe", slug: forwardSlug, id: `recipe-${forwardSlug}` }];
      });
      return forwardSlug;
    }

    // Load next recipe from API
    try {
      const nextSlug = await fetchRandomSlug(currentItem.slug);
      setItems((prev) => {
        if (prev.some((item) => item.type === "recipe" && item.slug === nextSlug)) {
          return prev;
        }
        return [...prev, { type: "recipe", slug: nextSlug, id: `recipe-${nextSlug}` }];
      });
      return nextSlug;
    } catch (error) {
      console.error("Failed to load next recipe:", error);
      return null;
    }
  }, [currentIndex, items]);

  // Preload next recipe when on a recipe card
  useEffect(() => {
    const currentItem = items[currentIndex];
    if (currentItem?.type === "recipe") {
      loadNextRecipe();
    }
  }, [currentIndex, items, loadNextRecipe]);

  const handleNavigate = useCallback(
    async (direction: "next" | "previous") => {
      const currentItem = items[currentIndex];

      if (direction === "next") {
        // Navigate to next item
        if (currentIndex < items.length - 1) {
          // Next item already exists
          const nextIndex = currentIndex + 1;
          const nextItem = items[nextIndex];

          // Update history if coming from a recipe
          if (currentItem?.type === "recipe" && nextItem?.type === "recipe") {
            const snapshot =
              historySnapshotRef.current ?? syncHistoryWithCurrentSlug(currentItem.slug);
            historySnapshotRef.current = pushSlugOntoHistory(snapshot, nextItem.slug);
          }

          setCurrentIndex(nextIndex);
        } else if (currentItem?.type === "recipe") {
          // Need to load next recipe
          const nextSlug = await loadNextRecipe();
          if (nextSlug) {
            setItems((prev) => {
              // Find the newly added recipe
              const addedIndex = prev.findIndex(
                (item) => item.type === "recipe" && item.slug === nextSlug,
              );
              if (addedIndex !== -1) {
                // Update history
                const snapshot =
                  historySnapshotRef.current ?? syncHistoryWithCurrentSlug(currentItem.slug);
                historySnapshotRef.current = pushSlugOntoHistory(snapshot, nextSlug);

                setCurrentIndex(addedIndex);
              }
              return prev;
            });
          }
        }
      } else if (direction === "previous") {
        // Navigate to previous item
        if (currentIndex > 0) {
          const prevIndex = currentIndex - 1;
          const prevItem = items[prevIndex];

          // If going back to feed (index 0), always allow it
          // Clean up carousel to only have feed when returning to it
          if (prevItem?.type === "feed") {
            setItems([{ type: "feed", id: "feed" }]);
            setCurrentIndex(0);
            return;
          }

          // If going from recipe to recipe, check history
          if (prevItem?.type === "recipe" && currentItem?.type === "recipe") {
            const snapshot =
              historySnapshotRef.current ?? syncHistoryWithCurrentSlug(currentItem.slug);
            const movedSnapshot = moveHistoryBackward(snapshot);
            if (movedSnapshot) {
              // There's history, go to previous recipe
              historySnapshotRef.current = movedSnapshot;
              setCurrentIndex(prevIndex);
              return;
            } else {
              // No history, go to feed instead - clean up carousel
              setItems([{ type: "feed", id: "feed" }]);
              setCurrentIndex(0);
              return;
            }
          }

          // Regular navigation
          setCurrentIndex(prevIndex);
        } else if (currentItem?.type === "recipe") {
          // On first recipe, check if there's history or go to feed
          const snapshot =
            historySnapshotRef.current ?? syncHistoryWithCurrentSlug(currentItem.slug);
          const movedSnapshot = moveHistoryBackward(snapshot);

          if (movedSnapshot) {
            // There's history - use browser back to go to previous recipe
            historySnapshotRef.current = movedSnapshot;
            router.back();
            return;
          } else {
            // No history, go to feed - clean up carousel
            setItems([{ type: "feed", id: "feed" }]);
            setCurrentIndex(0);
          }
        }
      }

      // Update snapshot after state updates
      setTimeout(() => {
        lastSnapshot = {
          currentIndex: direction === "next" ? currentIndex + 1 : Math.max(0, currentIndex - 1),
          items,
        };
      }, 0);
    },
    [currentIndex, items, router, loadNextRecipe, setCurrentIndex],
  );

  // Render carousel item
  const renderItem = useCallback((item: CarouselItem) => {
    if (item.type === "feed") {
      return <FeedCard />;
    } else {
      return <Recipe slug={item.slug} />;
    }
  }, []);

  // Only show carousel on mobile
  if (!isMobileDevice) {
    return <>{children}</>;
  }

  // Check if previous navigation should be disabled
  // Allow swiping back if:
  // 1. We're not at index 0 (feed is always at index 0, so we can always go back to it)
  // 2. OR if going to a previous recipe that exists in carousel
  const disablePrevious = currentIndex === 0;

  // Show back button when on a recipe (not on feed)
  const showBackButton = currentIndex > 0;

  return (
    <div className="h-screen overflow-hidden sm:hidden">
      {showBackButton && (
        <button
          onClick={() => router.push("/feed")}
          className="fixed top-4 left-4 z-[100] flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md transition hover:bg-slate-50"
          aria-label="Back to feed"
        >
          <FiChevronLeft className="h-5 w-5 text-slate-700" />
        </button>
      )}
      <SwipeableCarousel
        items={items}
        currentIndex={currentIndex}
        onNavigate={handleNavigate}
        renderItem={renderItem}
        disablePrevious={disablePrevious}
      />
    </div>
  );
}
