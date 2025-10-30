"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    console.log("Recipe component mounted for slug:", slug);
    return () => {
      console.log("recipe unmounted");
    };
  }, [slug]);

  if (isLoading) {
    return (
      <div className="flex w-full flex-col bg-white pb-12 text-base leading-relaxed text-slate-600">
        <div className="flex w-full items-center justify-center py-32">
          <p className="text-lg text-slate-600">Loading recipe...</p>
        </div>
      </div>
    );
  }

  if (error || !recipeData) {
    return (
      <div className="flex w-full flex-col bg-white pb-12 text-base leading-relaxed text-slate-600">
        <div className="flex w-full items-center justify-center py-32">
          <p className="text-lg text-red-600">{error || "Recipe not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <article className="flex w-full flex-col bg-white text-base leading-relaxed text-slate-600">
      <RecipeImage name={recipeData.name} imageUrl={recipeData.imageUrl} slug={recipeData.slug} />
      <Description description={recipeData.description || null} tags={recipeData.tags} />
      <Ingredients ingredients={recipeData.ingredients} />
      <Instructions instructions={recipeData.instructions} />
    </article>
  );
}
