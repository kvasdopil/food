"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { RecipeSearchBar } from "@/components/recipe-search-bar";
import { UserAvatar } from "@/components/user-avatar";
import { AddRecipeButton } from "@/components/add-recipe-button";
import { AddRecipeModal } from "@/components/add-recipe-modal";
import { FavoritesToggle } from "@/components/favorites-toggle";
import { useTags } from "@/hooks/useTags";
import { useAuth } from "@/hooks/useAuth";
import { useSearchQuery } from "@/hooks/useSearchQuery";
import { storeFeedUrl } from "@/lib/tag-utils";

function FeedLayoutContent({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { activeTags, removeTag, clearAllTags } = useTags();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { query, setQuery } = useSearchQuery({ tags: activeTags });

  // Get favorites filter state from URL
  const isFavoritesActive = searchParams.get("favorites") === "true";

  // Clear favorites filter when user logs out (if it was active)
  useEffect(() => {
    if (!user && isFavoritesActive) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("favorites");
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [user, isFavoritesActive, searchParams, pathname, router]);

  // Toggle favorites filter
  const toggleFavorites = () => {
    // Should not be called when logged out (FavoritesToggle handles this)
    if (!user) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (isFavoritesActive) {
      params.delete("favorites");
    } else {
      params.set("favorites", "true");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  // Store current feed URL in sessionStorage to preserve filters when navigating to recipes
  useEffect(() => {
    storeFeedUrl();
  }, [searchParams]); // Update whenever URL params change

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl sm:px-6 sm:py-6 lg:px-8">
        <div className="px-4 pt-0 sm:px-0 sm:pt-0">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-2">
              <FavoritesToggle isActive={isFavoritesActive} onToggle={toggleFavorites} />
              <div className="flex-1">
                <RecipeSearchBar
                  value={query}
                  onChange={setQuery}
                  activeTags={activeTags}
                  onRemoveTag={removeTag}
                  onClearAllTags={clearAllTags}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user && <AddRecipeButton onClick={() => setIsModalOpen(true)} />}
              <UserAvatar />
            </div>
          </div>
        </div>
        {children}
      </main>
      <AddRecipeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <FeedLayoutContent>{children}</FeedLayoutContent>
    </Suspense>
  );
}
