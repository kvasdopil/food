"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { RecipeSearchBar } from "@/components/recipe-search-bar";
import { UserAvatar } from "@/components/user-avatar";
import { AddRecipeButton } from "@/components/add-recipe-button";
import { RecipeModal } from "@/components/recipe-modal";
import { FavoritesToggle } from "@/components/favorites-toggle";
import { useTags } from "@/hooks/useTags";
import { useAuth } from "@/hooks/useAuth";
import { useSearchQuery } from "@/hooks/useSearchQuery";
import { storeFeedUrl, buildFeedUrlWithTagsAndSearch } from "@/lib/tag-utils";
import { LikesProvider } from "@/contexts/likes-context";

function FeedLayoutContent({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { activeTags, removeTag, clearAllTags } = useTags();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { query, setQuery } = useSearchQuery({ tags: activeTags });

  // Get favorites filter state from URL
  const isFavoritesActive = searchParams.get("favorites") === "true";
  // Check if "mine" tag is active (special tag for filtering by author)
  const hasMineTag = activeTags.includes("mine");

  // Clear favorites filter when user logs out (if it was active)
  // Only clear if auth is not loading (to prevent clearing on page refresh)
  useEffect(() => {
    if (!authLoading && !user && isFavoritesActive) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("favorites");
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [authLoading, user, isFavoritesActive, searchParams, pathname, router]);

  // Clear "mine" tag when user logs out (if it was active)
  // Only clear if auth is not loading (to prevent clearing on page refresh)
  useEffect(() => {
    if (!authLoading && !user && hasMineTag) {
      const newTags = activeTags.filter((tag) => tag !== "mine");
      const searchQuery = searchParams.get("q") || "";
      // Preserve favorites parameter when rebuilding URL
      router.replace(buildFeedUrlWithTagsAndSearch(newTags, searchQuery, searchParams));
    }
  }, [authLoading, user, hasMineTag, activeTags, searchParams, router]);

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
        <div className="pt-0 pr-4 pl-2 sm:px-0 sm:pt-0">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center">
              <FavoritesToggle isActive={isFavoritesActive} onToggle={toggleFavorites} />
              <RecipeSearchBar
                value={query}
                onChange={setQuery}
                activeTags={activeTags}
                onRemoveTag={removeTag}
                onClearAllTags={clearAllTags}
              />
            </div>
            <div className="flex items-center gap-2">
              <AddRecipeButton
                onClick={() => {
                  if (user) {
                    setIsModalOpen(true);
                  } else {
                    signInWithGoogle();
                  }
                }}
              />
              <UserAvatar />
            </div>
          </div>
        </div>
        {children}
      </main>
      <RecipeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} mode="create" />
    </div>
  );
}

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return (
    <LikesProvider>
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <FeedLayoutContent>{children}</FeedLayoutContent>
      </Suspense>
    </LikesProvider>
  );
}
