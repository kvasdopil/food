'use client';

import { useCallback, useState } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { useRouter } from "next/navigation";

type RecipeSideNavProps = {
  direction: "previous" | "next";
  currentSlug: string;
};

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

export function RecipeSideNav({ direction, currentSlug }: RecipeSideNavProps) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const isPrevious = direction === "previous";
  const label = isPrevious ? "Previous Recipe" : "Next Recipe";
  const Icon = isPrevious ? FiArrowLeft : FiArrowRight;

  const navigateToRandom = useCallback(async () => {
    setIsBusy(true);
    try {
      const slug = await fetchRandomSlug(currentSlug);
      router.push(`/recipes/${slug}`);
    } catch (error) {
      console.error("Random navigation failed:", error);
    } finally {
      setIsBusy(false);
    }
  }, [currentSlug, router]);

  const handleClick = useCallback(async () => {
    if (isPrevious) {
      if (window.history.length > 1) {
        router.back();
        return;
      }
      await navigateToRandom();
      return;
    }

    await navigateToRandom();
  }, [isPrevious, navigateToRandom, router]);

  return (
    <div
      className={`hidden xl:flex xl:w-40 xl:flex-col ${
        isPrevious ? "" : "xl:items-end"
      }`}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={isBusy}
        className="sticky top-1/2 inline-flex -translate-y-1/2 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPrevious ? (
          <>
            <Icon className="h-5 w-5 text-amber-500" />
            {label}
          </>
        ) : (
          <>
            {label}
            <Icon className="h-5 w-5 text-amber-500" />
          </>
        )}
      </button>
    </div>
  );
}
