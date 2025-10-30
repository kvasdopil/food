"use client";

import { useCallback, useState } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { useRouter } from "next/navigation";

import { useRecipeNavigation } from "@/app/recipes/[slug]/client/navigation-provider";
import { fetchRandomSlug } from "@/lib/random-recipe";

type RecipeSideNavProps = {
  direction: "previous" | "next";
  currentSlug: string;
};

export function RecipeSideNav({ direction, currentSlug }: RecipeSideNavProps) {
  const router = useRouter();
  const { getNextSlug } = useRecipeNavigation();
  const [isBusy, setIsBusy] = useState(false);
  const isPrevious = direction === "previous";
  const label = isPrevious ? "Previous Recipe" : "Next Recipe";
  const Icon = isPrevious ? FiArrowLeft : FiArrowRight;

  const navigateToRandom = useCallback(async () => {
    setIsBusy(true);
    try {
      const slug = await getNextSlug();
      router.push(`/recipes/${slug}`);
    } catch (error) {
      console.error("Prefetched navigation failed:", error);
      try {
        const fallbackSlug = await fetchRandomSlug(currentSlug);
        router.push(`/recipes/${fallbackSlug}`);
      } catch (fallbackError) {
        console.error("Fallback navigation failed:", fallbackError);
      }
    } finally {
      setIsBusy(false);
    }
  }, [currentSlug, getNextSlug, router]);

  const hasSameOriginHistory = document.referrer && new URL(document.referrer).origin === window.location.origin;

  const handleClick = useCallback(async () => {
    if (isPrevious) {
      if (hasSameOriginHistory) {
        router.back();
        return;
      }
      await navigateToRandom();
      return;
    }

    await navigateToRandom();
  }, [isPrevious, navigateToRandom, router, hasSameOriginHistory]);

  // Hide previous button if there's no same-origin history
  if (isPrevious && !hasSameOriginHistory) {
    return null;
  }

  return (
    <div className={`hidden xl:flex xl:w-40 xl:flex-col ${isPrevious ? "" : "xl:items-end"}`}>
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
