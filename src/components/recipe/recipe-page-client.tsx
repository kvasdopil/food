"use client";

import { useRouter } from "next/navigation";

import { KeyboardNav } from "@/components/keyboard-nav";
import { RecipeSideNav } from "@/components/recipe-side-nav";
import { RecipeSwipeableCarousel } from "./recipe-swipeable-carousel";
import { PreloadProvider } from "./preload-provider";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { fetchRandomSlug } from "@/lib/random-recipe";
import { Recipe } from "./recipe";

type RecipePageClientProps = {
  slug: string;
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

export function RecipePageClient({ slug }: RecipePageClientProps) {
  const router = useRouter();

  const handleNavigateNext = async (nextSlug: string) => {
    router.push(`/recipes/${nextSlug}`);
  };

  const handleNavigatePrevious = async () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    const randomSlug = await fetchRandomSlug(slug);
    router.push(`/recipes/${randomSlug}`);
  };

  return (
    <PreloadProvider currentSlug={slug}>
      <SwipeNavigationHandler
        currentSlug={slug}
        onNavigateNext={handleNavigateNext}
        onNavigatePrevious={handleNavigatePrevious}
      />
      <main className="relative min-h-screen bg-slate-50 text-slate-900">
        <KeyboardNav currentSlug={slug} />
        <div className="mx-auto flex w-full max-w-5xl min-h-screen flex-col px-0 sm:px-6 xl:flex-row xl:items-stretch xl:gap-6">
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
    </PreloadProvider>
  );
}
