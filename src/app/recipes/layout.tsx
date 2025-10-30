"use client";

import { usePathname } from "next/navigation";
import { KeyboardNav } from "@/components/keyboard-nav";
import { RecipeSideNav } from "@/components/recipe-side-nav";
import { RecipeSwipeableCarousel } from "./[slug]/client/recipe-swipeable-carousel";
import { NavigationProvider } from "./[slug]/client/navigation-provider";
import { Recipe } from "@/components/recipe/recipe";

type RecipesLayoutProps = {
  children: React.ReactNode;
};

export default function RecipesLayout({ children }: RecipesLayoutProps) {
  const pathname = usePathname();
  // Extract slug from pathname like /recipes/slug-name or /recipes/slug-name/...
  const match = pathname?.match(/^\/recipes\/([^/]+)/);
  const slug = match?.[1] || "";

  // If no slug (e.g., on /recipes route), just render children
  if (!slug) {
    return <>{children}</>;
  }

  return (
    <NavigationProvider currentSlug={slug}>
      <main className="relative min-h-screen bg-slate-50 text-slate-900">
        <KeyboardNav currentSlug={slug} />
        <div className="mx-auto flex w-full max-w-5xl min-h-screen flex-col px-0 sm:px-6 xl:flex-row xl:items-stretch xl:gap-6">
          <RecipeSideNav direction="previous" currentSlug={slug} />

          {/* Mobile: Swipeable Carousel - persists across navigation */}
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

