"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { KeyboardNav } from "@/components/keyboard-nav";
import { RecipeSideNav } from "@/components/recipe-side-nav";
import { RecipeContent } from "./content";
import { SwipeableCarousel } from "./swipeable-carousel";
import { PreloadProvider } from "./preload-provider";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { fetchRandomSlug } from "@/lib/random-recipe";
import type { RecipeData } from "@/lib/fetch-recipe-data";

type RecipePageClientProps = {
  recipe: {
    slug: string;
    name: string;
    description: string;
    ingredients: string;
    instructions: string;
    imageUrl: string | null;
    tags: string[];
  };
};

function SwipeNavigationHandler({
  currentSlug,
  onNavigateNext,
  onNavigatePrevious,
}: {
  currentSlug: string;
  onNavigateNext: (slug: string) => Promise<void>;
  onNavigatePrevious: () => Promise<void>;
}) {
  useSwipeNavigation({
    currentSlug,
    onNavigateNext,
    onNavigatePrevious,
  });

  return null;
}

export function RecipePageClient({ recipe }: RecipePageClientProps) {
  const router = useRouter();
  const [currentRecipe, setCurrentRecipe] = useState<RecipeData>(recipe);

  // Update current recipe when recipe prop changes (from URL change)
  useEffect(() => {
    setCurrentRecipe(recipe);
  }, [recipe]);

  const handleNavigateNext = async (slug: string) => {
    router.push(`/recipes/${slug}`);
  };

  const handleNavigatePrevious = async () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    const slug = await fetchRandomSlug(recipe.slug);
    router.push(`/recipes/${slug}`);
  };

  const initialRecipeData: RecipeData = {
    slug: recipe.slug,
    name: recipe.name,
    description: recipe.description,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    imageUrl: recipe.imageUrl,
    tags: recipe.tags,
  };

  return (
    <PreloadProvider currentSlug={currentRecipe.slug}>
      <SwipeNavigationHandler
        currentSlug={currentRecipe.slug}
        onNavigateNext={handleNavigateNext}
        onNavigatePrevious={handleNavigatePrevious}
      />
      <main className="relative min-h-screen bg-slate-50 text-slate-900">
        <KeyboardNav currentSlug={currentRecipe.slug} />
        <div className="mx-auto flex w-full max-w-5xl flex-col px-0 sm:px-6 xl:flex-row xl:items-stretch xl:gap-6">
          <RecipeSideNav direction="previous" currentSlug={currentRecipe.slug} />
          
          {/* Mobile: Swipeable Carousel */}
          <div className="w-full sm:hidden">
            <SwipeableCarousel recipe={initialRecipeData} />
          </div>

          {/* Desktop: Standard Recipe Content */}
          <div className="hidden sm:block">
            <RecipeContent
              name={recipe.name}
              description={recipe.description || null}
              ingredients={recipe.ingredients}
              instructions={recipe.instructions}
              imageUrl={recipe.imageUrl}
              tags={recipe.tags}
              slug={recipe.slug}
            />
          </div>

          <RecipeSideNav direction="next" currentSlug={currentRecipe.slug} />
        </div>
      </main>
    </PreloadProvider>
  );
}
