"use client";

import { useEffect, useRef } from "react";
import { Description } from "./description";
import { RecipeImage } from "./image";
import { Ingredients } from "./ingredients";
import { Instructions } from "./instructions";
import { useRecipe } from "@/hooks/useRecipe";

type RecipeProps = {
  slug: string;
};

export function Recipe({ slug }: RecipeProps) {
  const { recipeData, isLoading, error } = useRecipe(slug);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
    return (
      <div className="h-full overflow-y-auto overscroll-contain">
        <div className="flex w-full flex-col bg-white pb-12 text-base leading-relaxed text-slate-600">
          <div className="flex w-full items-center justify-center py-32">
            <p className="text-lg text-slate-600">Loading recipe...</p>
          </div>
        </div>
      </div>
    );
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
    <div ref={scrollContainerRef} data-scroll-container className="h-full overflow-y-auto overscroll-contain">
      <article className="flex w-full flex-col bg-white text-base leading-relaxed text-slate-600">
        <RecipeImage name={recipeData.name} imageUrl={recipeData.imageUrl} slug={recipeData.slug} />
        <Description description={recipeData.description || null} tags={recipeData.tags} />
        <Ingredients ingredients={recipeData.ingredients} />
        <Instructions instructions={recipeData.instructions} />
      </article>
    </div>
  );
}
