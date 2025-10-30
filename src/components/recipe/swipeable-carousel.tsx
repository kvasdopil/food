"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useMotionValue, PanInfo, animate } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";

import { RecipeContent } from "./content";
import { fetchRecipeData, type RecipeData } from "@/lib/fetch-recipe-data";
import { fetchRandomSlug } from "@/lib/random-recipe";

type SwipeableCarouselProps = {
  recipe: RecipeData;
};

const SWIPE_THRESHOLD = 100;

export function SwipeableCarousel({ recipe }: SwipeableCarouselProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentRecipe, setCurrentRecipe] = useState<RecipeData>(recipe);
  const [nextRecipe, setNextRecipe] = useState<RecipeData | null>(null);
  const [previousRecipe, setPreviousRecipe] = useState<RecipeData | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // Keep opacity at 1 for the current card - no transparency
  const opacity = useMotionValue(1);

  // Load next recipe
  const loadNextRecipe = useCallback(async () => {
    if (nextRecipe) return;

    try {
      const nextSlug = await fetchRandomSlug(currentRecipe.slug);
      const data = await fetchRecipeData(nextSlug);
      if (data) {
        setNextRecipe(data);
      }
    } catch (error) {
      console.error("Failed to load next recipe:", error);
    }
  }, [currentRecipe.slug, nextRecipe]);

  // Load previous recipe
  const loadPreviousRecipe = useCallback(async () => {
    if (previousRecipe) return;

    try {
      // For previous, we'll use a random recipe as fallback
      // In a real app, you might want to track navigation history
      const prevSlug = await fetchRandomSlug(currentRecipe.slug);
      const data = await fetchRecipeData(prevSlug);
      if (data) {
        setPreviousRecipe(data);
      }
    } catch (error) {
      console.error("Failed to load previous recipe:", error);
    }
  }, [currentRecipe.slug, previousRecipe]);

  // Update current recipe when recipe prop or pathname changes (external navigation)
  useEffect(() => {
    if (recipe.slug !== currentRecipe.slug) {
      setPreviousRecipe(currentRecipe);
      setCurrentRecipe(recipe);
      setNextRecipe(null);
      x.set(0);
      loadNextRecipe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe.slug, pathname]);

  // Preload next recipe on mount
  useEffect(() => {
    loadNextRecipe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRecipe.slug]);

  // Log rendered cards and current route
  useEffect(() => {
    const cards = [];
    if (currentRecipe) cards.push(`current: ${currentRecipe.slug}`);
    if (previousRecipe && !isTransitioning) cards.push(`previous: ${previousRecipe.slug}`);
    if (nextRecipe && !isTransitioning) cards.push(`next: ${nextRecipe.slug}`);
    console.log("Rendered cards:", cards.join(", "), "| Route:", pathname, "| Transitioning:", isTransitioning);
  }, [currentRecipe, previousRecipe, nextRecipe, isTransitioning, pathname]);

  // Aggressively lock Y to 0 using requestAnimationFrame
  useEffect(() => {
    let rafId: number;
    const lockY = () => {
      y.set(0);
      rafId = requestAnimationFrame(lockY);
    };
    rafId = requestAnimationFrame(lockY);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [y]);

  const handleDragEnd = useCallback(
    async (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const offset = info.offset.x;
      const velocity = info.velocity.x;
      const offsetY = info.offset.y;

      // Get screen width to calculate 50% threshold
      const screenWidth = typeof window !== "undefined" ? window.innerWidth : 400;
      const threshold = screenWidth * 0.5;

      // Only navigate if horizontal movement is significant compared to vertical
      const isHorizontalSwipe = Math.abs(offset) > Math.abs(offsetY) * 1.5;

      // Determine if swipe is significant enough (distance or velocity)
      const isSignificantSwipe =
        isHorizontalSwipe && (Math.abs(offset) > SWIPE_THRESHOLD || Math.abs(velocity) > 500);

      // Navigate to next recipe (swipe left, negative offset)
      if (isSignificantSwipe && (offset < -SWIPE_THRESHOLD || velocity < -500)) {
        setIsTransitioning(true);
        
        // Check if we need to animate to edge first
        if (Math.abs(offset) >= threshold) {
          // Animate to left edge
          await animate(x, -screenWidth, {
            duration: 0.3,
            ease: "easeOut",
          });
        }

        // Navigate to next recipe
        if (nextRecipe) {
          // Hide underlying recipes during transition
          setPreviousRecipe(null);
          setNextRecipe(null);
          // Update current recipe
          setCurrentRecipe(nextRecipe);
          router.replace(`/recipes/${nextRecipe.slug}`, { scroll: false });
          // Wait for React to process the state update
          await new Promise((resolve) => requestAnimationFrame(resolve));
          await new Promise((resolve) => requestAnimationFrame(resolve));
          x.set(0);
          setIsTransitioning(false);
          loadNextRecipe();
        } else {
          const nextSlug = await fetchRandomSlug(currentRecipe.slug);
          const data = await fetchRecipeData(nextSlug);
          if (data) {
            setPreviousRecipe(null);
            setNextRecipe(null);
            setCurrentRecipe(data);
            router.replace(`/recipes/${data.slug}`, { scroll: false });
            await new Promise((resolve) => requestAnimationFrame(resolve));
            await new Promise((resolve) => requestAnimationFrame(resolve));
            x.set(0);
            setIsTransitioning(false);
            loadNextRecipe();
          } else {
            setIsTransitioning(false);
            await animate(x, 0, { duration: 0.3, ease: "easeOut" });
          }
        }
        return;
      }

      // Navigate to previous recipe (swipe right, positive offset)
      if (isSignificantSwipe && (offset > SWIPE_THRESHOLD || velocity > 500)) {
        setIsTransitioning(true);
        
        // Check if we need to animate to edge first
        if (Math.abs(offset) >= threshold) {
          // Animate to right edge
          await animate(x, screenWidth, {
            duration: 0.3,
            ease: "easeOut",
          });
        }

        // Navigate to previous recipe
        if (previousRecipe) {
          // Hide underlying recipes during transition
          setNextRecipe(null);
          setPreviousRecipe(null);
          // Update current recipe
          setCurrentRecipe(previousRecipe);
          router.replace(`/recipes/${previousRecipe.slug}`, { scroll: false });
          // Wait for React to process the state update
          await new Promise((resolve) => requestAnimationFrame(resolve));
          await new Promise((resolve) => requestAnimationFrame(resolve));
          x.set(0);
          setIsTransitioning(false);
          loadPreviousRecipe();
        } else {
          const prevSlug = await fetchRandomSlug(currentRecipe.slug);
          const data = await fetchRecipeData(prevSlug);
          if (data) {
            setNextRecipe(null);
            setPreviousRecipe(null);
            setCurrentRecipe(data);
            router.replace(`/recipes/${data.slug}`, { scroll: false });
            await new Promise((resolve) => requestAnimationFrame(resolve));
            await new Promise((resolve) => requestAnimationFrame(resolve));
            x.set(0);
            setIsTransitioning(false);
            loadPreviousRecipe();
          } else {
            setIsTransitioning(false);
            await animate(x, 0, { duration: 0.3, ease: "easeOut" });
          }
        }
        return;
      }

      // If swipe is less than 50% or not significant, animate back to center
      await animate(x, 0, {
        duration: 0.3,
        ease: "easeOut",
      });
    },
    [x, router, currentRecipe, nextRecipe, previousRecipe, loadNextRecipe, loadPreviousRecipe],
  );

  return (
    <div
      className="relative w-full min-h-screen overflow-x-hidden bg-slate-50 sm:hidden"
      style={{ touchAction: "pan-y pinch-zoom" }}
    >
      {/* Previous recipe (behind, revealed on swipe right) */}
      {previousRecipe && !isTransitioning && (
        <div className="absolute inset-0 z-0 w-full pointer-events-none">
          <RecipeContent
            name={previousRecipe.name}
            description={previousRecipe.description || null}
            ingredients={previousRecipe.ingredients}
            instructions={previousRecipe.instructions}
            imageUrl={previousRecipe.imageUrl}
            tags={previousRecipe.tags}
            slug={previousRecipe.slug}
          />
        </div>
      )}

      {/* Next recipe (behind, revealed on swipe left) */}
      {nextRecipe && !isTransitioning && (
        <div className="absolute inset-0 z-0 w-full pointer-events-none">
          <RecipeContent
            name={nextRecipe.name}
            description={nextRecipe.description || null}
            ingredients={nextRecipe.ingredients}
            instructions={nextRecipe.instructions}
            imageUrl={nextRecipe.imageUrl}
            tags={nextRecipe.tags}
            slug={nextRecipe.slug}
          />
        </div>
      )}

      {/* Current recipe (draggable) - Always visible */}
      <motion.div
        className="relative z-10 w-full shadow-2xl shadow-slate-900/20"
        style={{
          x,
          y: 0,
          opacity,
          touchAction: "pan-y",
          willChange: "transform",
        }}
        drag="x"
        dragDirectionLock={true}
        dragMomentum={false}
        dragConstraints={{ left: -1000, right: 1000, top: 0, bottom: 0 }}
        dragElastic={0.2}
        dragPropagation={false}
        onDragStart={() => {
          y.set(0);
        }}
        onDrag={(event) => {
          // Force Y to 0 continuously
          y.set(0);

          // Override DOM transform directly to force translateY(0)
          const element = event?.currentTarget as HTMLElement;
          if (element) {
            const currentX = x.get();
            // Force transform with explicit translateY(0) and no scale
            element.style.transform = `translateX(${currentX}px) translateY(0px)`;
          }
        }}
        onDragEnd={(event, info) => {
          // Reset Y before handling drag end
          y.set(0);
          handleDragEnd(event, info);
        }}
        initial={{ x: 0, y: 0 }}
        animate={{ x: 0, y: 0 }}
        whileDrag={{ cursor: "grabbing", y: 0 }}
      >
        <RecipeContent
          name={currentRecipe.name}
          description={currentRecipe.description || null}
          ingredients={currentRecipe.ingredients}
          instructions={currentRecipe.instructions}
          imageUrl={currentRecipe.imageUrl}
          tags={currentRecipe.tags}
          slug={currentRecipe.slug}
        />
      </motion.div>
    </div>
  );
}
