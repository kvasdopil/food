"use client";

import { useRouter } from "next/navigation";

import { KeyboardNav } from "@/components/keyboard-nav";
import { RecipeSideNav } from "@/components/recipe-side-nav";
import { RecipeContent } from "./content";
import { PreloadProvider } from "./preload-provider";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { fetchRandomSlug } from "@/lib/random-recipe";

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

  return (
    <PreloadProvider currentSlug={recipe.slug}>
      <SwipeNavigationHandler
        currentSlug={recipe.slug}
        onNavigateNext={handleNavigateNext}
        onNavigatePrevious={handleNavigatePrevious}
      />
      <main className="relative min-h-screen bg-slate-50 text-slate-900">
        <KeyboardNav currentSlug={recipe.slug} />
        <div className="mx-auto flex w-full max-w-5xl flex-col px-0 sm:px-6 xl:flex-row xl:items-stretch xl:gap-6">
          <RecipeSideNav direction="previous" currentSlug={recipe.slug} />
          <RecipeContent
            name={recipe.name}
            description={recipe.description || null}
            ingredients={recipe.ingredients}
            instructions={recipe.instructions}
            imageUrl={recipe.imageUrl}
            tags={recipe.tags}
            slug={recipe.slug}
          />
          <RecipeSideNav direction="next" currentSlug={recipe.slug} />
        </div>
      </main>
    </PreloadProvider>
  );
}
