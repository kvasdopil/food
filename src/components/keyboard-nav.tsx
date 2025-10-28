'use client';

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

async function fetchRandomSlug(exclude?: string) {
  const url = exclude
    ? `/api/random-recipe?exclude=${encodeURIComponent(exclude)}`
    : "/api/random-recipe";

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to fetch random recipe slug");
  }

  const body = (await response.json()) as { slug?: string };
  if (!body.slug) {
    throw new Error("Random slug missing from response");
  }
  return body.slug;
}

type KeyboardNavProps = {
  currentSlug: string;
};

export function KeyboardNav({ currentSlug }: KeyboardNavProps) {
  const router = useRouter();

  const handleKeydown = useCallback(
    async (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isTyping) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (window.history.length > 1) {
          router.back();
        } else {
          const slug = await fetchRandomSlug(currentSlug);
          router.push(`/recipes/${slug}`);
        }
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        const slug = await fetchRandomSlug(currentSlug);
        router.push(`/recipes/${slug}`);
      }
    },
    [currentSlug, router],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [handleKeydown]);

  return null;
}

