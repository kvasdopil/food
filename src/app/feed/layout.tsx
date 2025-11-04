"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RecipeSearchBar } from "@/components/recipe-search-bar";
import { UserAvatar } from "@/components/user-avatar";
import { AddRecipeButton } from "@/components/add-recipe-button";
import { AddRecipeModal } from "@/components/add-recipe-modal";
import { useTags } from "@/hooks/useTags";
import { useAuth } from "@/hooks/useAuth";
import { useSearchQuery } from "@/hooks/useSearchQuery";
import { storeFeedUrl } from "@/lib/tag-utils";

function FeedLayoutContent({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const { activeTags, removeTag, clearAllTags } = useTags();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { query, setQuery } = useSearchQuery({ tags: activeTags });

  // Store current feed URL in sessionStorage to preserve filters when navigating to recipes
  useEffect(() => {
    storeFeedUrl();
  }, [searchParams]); // Update whenever URL params change

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-7xl sm:px-6 sm:py-6 lg:px-8">
        <div className="px-4 pt-4 sm:px-0 sm:pt-0">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <RecipeSearchBar
                value={query}
                onChange={setQuery}
                activeTags={activeTags}
                onRemoveTag={removeTag}
                onClearAllTags={clearAllTags}
              />
            </div>
            <div className="flex h-[48px] items-center gap-2">
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
