"use client";

import { KeyboardNav } from "@/components/keyboard-nav";
import { RecipeSideNav } from "@/components/recipe-side-nav";
import { RecipeSwipeableCarousel } from "./recipe-swipeable-carousel";
import { NavigationProvider } from "./navigation-provider";
import { Recipe } from "@/components/recipe/recipe";

type RecipePageClientProps = {
  slug: string;
};

export function RecipePageClient({ slug }: RecipePageClientProps) {
  return (
    <NavigationProvider currentSlug={slug}>
      <main className="relative min-h-screen bg-slate-50 text-slate-900">
        <KeyboardNav currentSlug={slug} />
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-0 sm:px-6 xl:flex-row xl:items-stretch xl:gap-6">
          <RecipeSideNav direction="previous" currentSlug={slug} />

          {/* Mobile: Swipeable Carousel */}
          <div className="w-full sm:hidden">
            <RecipeSwipeableCarousel slug={slug} />
          </div>

          {/* Desktop: Standard Recipe Content */}
          <div className="hidden sm:block">
            <Recipe slug={slug} />
          </div>

          <RecipeSideNav direction="next" currentSlug={slug} />
        </div>
      </main>
    </NavigationProvider>
  );
}
