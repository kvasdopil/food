"use client";

import { useEffect, useRef, useMemo } from "react";
import { Description } from "./description";
import { RecipeImage } from "./image";
import { Ingredients } from "./ingredients";
import { Instructions } from "./instructions";
import { useRecipe } from "@/hooks/useRecipe";
import { RecipeSkeleton } from "@/components/skeletons/recipe-skeleton";
import { recipeStore } from "@/lib/recipe-store";

type RecipeProps = {
  slug: string;
};

export function Recipe({ slug }: RecipeProps) {
  const { recipeData, isLoading, error } = useRecipe(slug);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Check for cached partial data when loading
  const cachedPartial = useMemo(() => {
    if (!isLoading) return null;
    return recipeStore.getPartial(slug);
  }, [isLoading, slug]);

  useEffect(() => {
    console.log("Recipe component mounted for slug:", slug);
    // Reset scroll position when slug changes
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    return () => {
      console.log("recipe unmounted");
    };
  }, [slug]);

  if (isLoading) {
    // If we have cached partial data, show it with skeletons for missing parts
    if (cachedPartial) {
      return (
        <div
          ref={scrollContainerRef}
          data-scroll-container
          className="h-full overflow-y-auto overscroll-contain"
          style={{ touchAction: "pan-y" }}
        >
          <article className="flex w-full flex-col bg-white text-base leading-relaxed text-slate-600">
            <RecipeImage
              name={cachedPartial.name}
              imageUrl={cachedPartial.image_url}
              slug={cachedPartial.slug}
              prepTimeMinutes={cachedPartial.prep_time_minutes ?? null}
              cookTimeMinutes={cachedPartial.cook_time_minutes ?? null}
            />
            <Description
              description={cachedPartial.description || null}
              tags={cachedPartial.tags}
            />
            {/* Show skeletons for ingredients and instructions while loading */}
            <RecipeSkeleton showOnlyIngredientsAndInstructions />
          </article>
        </div>
      );
    }
    // No cached data, show full skeleton
    return <RecipeSkeleton />;
  }

  if (error || !recipeData) {
    return (
      <div className="h-full overflow-y-auto overscroll-contain">
        <div className="flex w-full flex-col bg-white pb-12 text-base leading-relaxed text-slate-600">
          <div className="flex w-full items-center justify-center py-32">
            <p className="text-lg text-red-600">{error || "Recipe not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      data-scroll-container
      className="h-full overflow-y-auto overscroll-contain"
      style={{ touchAction: "pan-y" }}
    >
      <article className="flex w-full flex-col bg-white text-base leading-relaxed text-slate-600">
        <RecipeImage
          name={recipeData.name}
          imageUrl={recipeData.imageUrl}
          slug={recipeData.slug}
          prepTimeMinutes={recipeData.prepTimeMinutes}
          cookTimeMinutes={recipeData.cookTimeMinutes}
        />
        <Description description={recipeData.description || null} tags={recipeData.tags} />
        <Ingredients ingredients={recipeData.ingredients} />
        <Instructions instructions={recipeData.instructions} />
      </article>
    </div>
  );
}
