"use client";

import { useCallback, useEffect, useState } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { useRouter } from "next/navigation";

import { useRecipeNavigation } from "@/app/recipes/[slug]/client/navigation-provider";
import { fetchRandomSlug } from "@/lib/random-recipe";
import { hasPreviousRecipe } from "@/app/recipes/[slug]/client/recipe-history";

type RecipeSideNavProps = {
  direction: "previous" | "next";
  currentSlug: string;
};

export function RecipeSideNav({ direction, currentSlug }: RecipeSideNavProps) {
  const router = useRouter();
  const { getNextSlug } = useRecipeNavigation();
  const [isBusy, setIsBusy] = useState(false);
  const [canNavigateBack, setCanNavigateBack] = useState(false);
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateState = () => {
      setCanNavigateBack(hasPreviousRecipe());
    };

    updateState();
    window.addEventListener("popstate", updateState);
    return () => window.removeEventListener("popstate", updateState);
  }, [currentSlug]);

  const handleClick = useCallback(async () => {
    if (isPrevious) {
      if (!canNavigateBack) {
        return;
      }
      router.back();
      return;
    }

    await navigateToRandom();
  }, [canNavigateBack, isPrevious, navigateToRandom, router]);

  return (
    <div className={`hidden xl:flex xl:w-40 xl:flex-col ${isPrevious ? "" : "xl:items-end"}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isBusy || (isPrevious && !canNavigateBack)}
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
