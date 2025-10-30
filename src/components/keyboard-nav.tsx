"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

import { useRecipeNavigation } from "@/app/recipes/[slug]/client/navigation-provider";
import { fetchRandomSlug } from "@/lib/random-recipe";

type KeyboardNavProps = {
  currentSlug: string;
};

export function KeyboardNav({ currentSlug }: KeyboardNavProps) {
  const router = useRouter();
  const { getNextSlug } = useRecipeNavigation();

  const handleKeydown = useCallback(
    async (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (isTyping) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (window.history.length > 1) {
          router.back();
        } else {
          try {
            const slug = await getNextSlug();
            router.push(`/recipes/${slug}`);
          } catch (error) {
            console.error("Keyboard navigation (left) failed:", error);
            const slug = await fetchRandomSlug(currentSlug);
            router.push(`/recipes/${slug}`);
          }
        }
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        try {
          const slug = await getNextSlug();
          router.push(`/recipes/${slug}`);
        } catch (error) {
          console.error("Keyboard navigation (right) failed:", error);
          const slug = await fetchRandomSlug(currentSlug);
          router.push(`/recipes/${slug}`);
        }
      }
    },
    [currentSlug, getNextSlug, router],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [handleKeydown]);

  return null;
}
