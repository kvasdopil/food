"use client";

import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { FiChevronLeft } from "react-icons/fi";
import { KeyboardNav } from "@/components/keyboard-nav";
import { RecipeSideNav } from "@/components/recipe-side-nav";
import { NavigationProvider } from "./[slug]/client/navigation-provider";
import { Recipe } from "@/components/recipe/recipe";

type RecipesLayoutProps = {
  children: React.ReactNode;
};

export default function RecipesLayout({ children }: RecipesLayoutProps) {
  const router = useRouter();
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
      <main className="relative h-screen overflow-hidden bg-slate-50 text-slate-900">
        <KeyboardNav currentSlug={slug} />

        {/* Back to feed button */}
        <button
          onClick={() => router.push("/feed")}
          className="absolute top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md transition hover:bg-slate-50 sm:top-6 sm:left-6"
          aria-label="Back to feed"
        >
          <FiChevronLeft className="h-5 w-5 text-slate-700" />
        </button>

        {/* Mobile: Full width layout - content handled by root-level carousel (only visible below sm) */}
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col px-0 sm:hidden">
          {/* Mobile content handled by root-level carousel */}
        </div>

        {/* Medium/Desktop: Centered layout (visible on sm+) */}
        <div className="hidden h-full sm:flex sm:justify-center">
          <div className="relative flex h-full max-w-5xl items-stretch">
            {/* Side navs - only visible on xl+ */}
            <div className="absolute top-0 left-0 z-10 hidden h-full -translate-x-full items-center pr-6 xl:flex">
              <RecipeSideNav direction="previous" currentSlug={slug} />
            </div>

            {/* Centered recipe content - visible on sm+ */}
            <div className="h-full w-full">
              <Recipe slug={slug} />
            </div>

            <div className="absolute top-0 right-0 z-10 hidden h-full translate-x-full items-center pl-6 xl:flex">
              <RecipeSideNav direction="next" currentSlug={slug} />
            </div>
          </div>
        </div>
      </main>
    </NavigationProvider>
  );
}
