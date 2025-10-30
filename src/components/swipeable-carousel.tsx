"use client";

import { useCallback, useEffect, useState, ReactNode } from "react";
import { motion, useMotionValue, PanInfo, animate } from "framer-motion";

type SwipeableCarouselProps<T> = {
  items: T[];
  currentIndex: number;
  onNavigate: (direction: "next" | "previous") => void;
  renderItem: (item: T, isActive: boolean) => ReactNode;
  className?: string;
};

const SWIPE_THRESHOLD = 100;

export function SwipeableCarousel<T>({
  items,
  currentIndex,
  onNavigate,
  renderItem,
  className = ""
}: SwipeableCarouselProps<T>) {
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

      // Navigate to next item (swipe left, negative offset)
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

        // Navigate to next item
        onNavigate("next");

        // Wait for state updates and reset
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        x.set(0);
        setIsTransitioning(false);
        return;
      }

      // Navigate to previous item (swipe right, positive offset)
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

        // Navigate to previous item
        onNavigate("previous");

        // Wait for state updates and reset
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        x.set(0);
        setIsTransitioning(false);
        return;
      }

      // If swipe is less than 50% or not significant, animate back to center
      await animate(x, 0, {
        duration: 0.3,
        ease: "easeOut",
      });
    },
    [x, onNavigate],
  );

  return (
    <div
      className={`relative w-full min-h-screen overflow-x-hidden bg-slate-50 sm:hidden ${className}`}
      style={{ touchAction: "pan-y pinch-zoom" }}
    >
      {items.map((item, index) => {
        const isActive = index === currentIndex;
        const offset = index - currentIndex;
        const slot =
          offset === 0
            ? "current"
            : offset < 0
              ? `previous${Math.abs(offset)}`
              : `next${offset}`;
        const itemKey = `${slot}-${String(item)}`;

        if (!isActive && isTransitioning) {
          return null;
        }

        return (
          <motion.div
            key={itemKey}
            className={`w-full ${isActive ? "relative z-10 shadow-2xl shadow-slate-900/20" : "absolute inset-0 z-0 pointer-events-none"}`}
            style={{
              x: isActive ? x : 0,
              y: 0,
              opacity: isActive ? opacity : 1,
              touchAction: "pan-y",
              willChange: "transform",
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
            initial={{ x: 0, y: 0 }}
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
