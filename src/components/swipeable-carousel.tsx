"use client";

import { useCallback, useEffect, useState, ReactNode } from "react";
import { motion, useMotionValue, PanInfo, animate } from "framer-motion";

type SwipeableCarouselProps<T> = {
  items: T[];
  currentIndex: number;
  onNavigate: (direction: "next" | "previous") => void;
  renderItem: (item: T, isActive: boolean) => ReactNode;
  className?: string;
  disablePrevious?: boolean;
};

const SWIPE_THRESHOLD = 50;
const VELOCITY_THRESHOLD = 500;

export function SwipeableCarousel<T>({
  items,
  currentIndex,
  onNavigate,
  renderItem,
  className = "",
  disablePrevious = false
}: SwipeableCarouselProps<T>) {

  useEffect(() => {
    console.log("SwipeableCarousel component mounted");
    return () => {
      console.log("SwipeableCarousel component unmounted");
    };
  }, []);

  const [isTransitioning, setIsTransitioning] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // Keep opacity at 1 for the current card - no transparency
  const opacity = useMotionValue(1);

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

  useEffect(() => {
    console.log("SwipeableCarousel:", items);
  }, [items]);

  const handleDragEnd = useCallback(
    async (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const offset = info.offset.x;
      const velocity = info.velocity.x;
      const offsetY = info.offset.y;

      // Get screen width to calculate 50% threshold
      const screenWidth = typeof window !== "undefined" ? window.innerWidth : 400;
      const threshold = screenWidth * 0.5;

      // Get the actual visual position of the card (not just drag offset)
      const currentX = x.get();

      // Log finger release moment
      console.log("🎯 Finger released:", {
        fingerOffset: offset,
        cardVisualPosition: currentX,
        threshold: threshold,
        thresholdPercent: `${((Math.abs(currentX) / screenWidth) * 100).toFixed(1)}%`,
        crossedThreshold: Math.abs(currentX) >= threshold,
        velocity: velocity,
        velocityMagnitude: Math.abs(velocity),
      });

      // Only navigate if horizontal movement is significant compared to vertical
      const isHorizontalSwipe = Math.abs(offset) > Math.abs(offsetY) * 1.5;

      // Determine if swipe is significant enough (distance or velocity)
      const isSignificantSwipe =
        isHorizontalSwipe && (Math.abs(offset) > SWIPE_THRESHOLD || Math.abs(velocity) > VELOCITY_THRESHOLD);

      // Check if card has actually moved past 50% threshold visually
      const cardCrossedThreshold = Math.abs(currentX) >= threshold;

      // Navigate to next item (swipe left, negative offset)
      // Only navigate if card visually crossed 50% threshold
      if (isSignificantSwipe && (offset < -SWIPE_THRESHOLD || velocity < -VELOCITY_THRESHOLD) && cardCrossedThreshold) {
        setIsTransitioning(true);

        // Calculate remaining distance to edge
        const remainingDistance = Math.abs(-screenWidth - currentX);
        // Use velocity to calculate duration (velocity is in pixels/sec)
        // Clamp duration between 0.1s (fast) and 0.5s (slow)
        const velocityMagnitude = Math.abs(velocity);
        const calculatedDuration = velocityMagnitude > 0
          ? Math.max(0.1, Math.min(0.5, remainingDistance / velocityMagnitude))
          : 0.3;

        // Animate to left edge with velocity-based duration
        await animate(x, -screenWidth, {
          duration: calculatedDuration,
          ease: "easeOut",
        });

        // Navigate to next item
        onNavigate("next");

        // Wait for state updates to propagate and new item to render
        // await new Promise((resolve) => requestAnimationFrame(resolve));
        // await new Promise((resolve) => requestAnimationFrame(resolve));
        // await new Promise((resolve) => requestAnimationFrame(resolve));

        // Reset position immediately so new item is visible
        x.set(0);

        // Small delay to ensure new item is rendered before ending transition
        await new Promise((resolve) => setTimeout(resolve, 50));
        setIsTransitioning(false);
        return;
      }

      // Navigate to previous item (swipe right, positive offset)
      // Only navigate if card visually crossed 50% threshold and previous navigation is not disabled
      if (isSignificantSwipe && (offset > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) && !disablePrevious) {
        setIsTransitioning(true);

        // Calculate remaining distance to edge
        const remainingDistance = Math.abs(screenWidth - currentX);
        // Use velocity to calculate duration (velocity is in pixels/sec)
        // Clamp duration between 0.1s (fast) and 0.5s (slow)
        const velocityMagnitude = Math.abs(velocity);
        const calculatedDuration = velocityMagnitude > 0
          ? Math.max(0.1, Math.min(0.5, remainingDistance / velocityMagnitude))
          : 0.3;

        // Animate to right edge with velocity-based duration
        await animate(x, screenWidth, {
          duration: calculatedDuration,
          ease: "easeOut",
        });

        // Navigate to previous item
        onNavigate("previous");

        // Wait for state updates to propagate and new item to render
        // await new Promise((resolve) => requestAnimationFrame(resolve));
        // await new Promise((resolve) => requestAnimationFrame(resolve));
        // await new Promise((resolve) => requestAnimationFrame(resolve));

        // Reset position immediately so new item is visible
        x.set(0);

        // Small delay to ensure new item is rendered before ending transition
        await new Promise((resolve) => setTimeout(resolve, 50));
        setIsTransitioning(false);
        return;
      }

      // If swipe is less than 50% or not significant, animate back to center
      await animate(x, 0, {
        duration: 0.3,
        ease: "easeOut",
      });
    },
    [x, onNavigate, disablePrevious],
  );

  return (
    <div
      className={`relative w-full min-h-screen overflow-hidden bg-slate-50 sm:hidden ${className}`}
      style={{ touchAction: "pan-y pinch-zoom" }}
    >
      {items.map((item, index) => {
        const isActive = index === currentIndex;
        const offset = index - currentIndex;
        // Keep next/previous items visible during transition (they might become active)
        // Only hide items that are far from the active one
        const shouldHide = !isActive && isTransitioning && Math.abs(offset) > 1;

        return (
          <motion.div
            key={String(item)}
            layout={false}
            className={`w-full ${isActive ? "relative z-10 shadow-2xl shadow-slate-900/20" : "absolute inset-0 z-0 pointer-events-none"}`}
            style={{
              x: isActive ? x : 0,
              y: 0,
              // Ensure active item is always fully opaque, and adjacent items (next/previous) stay visible
              opacity: isActive ? opacity : (shouldHide ? 0 : 1),
              touchAction: "pan-y",
              willChange: "transform",
              visibility: isActive ? "visible" : (shouldHide ? "hidden" : "visible"),
              // Ensure next/previous items are behind but ready to become active
              zIndex: isActive ? 10 : (Math.abs(offset) === 1 ? 5 : 0),
            }}
            drag={isActive ? "x" : false}
            dragDirectionLock={true}
            dragMomentum={false}
            dragConstraints={{ left: -1000, right: 1000, top: 0, bottom: 0 }}
            dragElastic={0.2}
            dragPropagation={false}
            onDragStart={() => {
              if (isActive) {
                y.set(0);
              }
            }}
            onDrag={(event) => {
              if (!isActive) {
                return;
              }

              y.set(0);
              const element = event?.currentTarget as HTMLElement;
              if (element) {
                const currentX = x.get();
                element.style.transform = `translateX(${currentX}px) translateY(0px)`;
              }
            }}
            onDragEnd={(event, info) => {
              if (!isActive) {
                return;
              }

              y.set(0);
              handleDragEnd(event, info);
            }}
            initial={false}
            animate={{ x: 0, y: 0 }}
            whileDrag={isActive ? { cursor: "grabbing", y: 0 } : undefined}
          >
            {renderItem(item, isActive)}
          </motion.div>
        );
      })}
    </div>
  );
}
