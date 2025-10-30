"use client";

import { useEffect, useState } from "react";

import { Description } from "./description";
import { RecipeImage } from "./image";
import { Ingredients } from "./ingredients";
import { Instructions } from "./instructions";
import { fetchRecipeData, type RecipeData } from "@/lib/fetch-recipe-data";

type RecipeProps = {
  slug: string;
};

export function Recipe({ slug }: RecipeProps) {
  const [recipeData, setRecipeData] = useState<RecipeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch recipe data when slug changes
  useEffect(() => {
    let isActive = true;

    async function loadRecipe() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchRecipeData(slug);

        if (!isActive) {
          return;
        }

        if (!data) {
          setError("Recipe not found");
          setIsLoading(false);
          return;
        }

        setRecipeData(data);
      } catch (err) {
        if (!isActive) {
          return;
        }

        console.error("Failed to load recipe:", err);
        setError("Failed to load recipe");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadRecipe();

    return () => {
      isActive = false;
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

