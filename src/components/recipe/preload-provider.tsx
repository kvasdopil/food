"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import { fetchRandomSlug } from "@/lib/random-recipe";
import { resolveRecipeImageUrl } from "@/lib/resolve-recipe-image-url";

type PrefetchedRecipe = {
  slug: string;
  imageUrl: string | null;
};

type RecipePreloadContextValue = {
  getNextSlug: () => Promise<string>;
  prefetchedSlug: string | null;
  isPrefetching: boolean;
};

const RecipePreloadContext = createContext<RecipePreloadContextValue | null>(null);

async function preloadImage(url: string | null) {
  if (!url || typeof window === "undefined") {
    return;
  }

  await new Promise<void>((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

export function PreloadProvider({
  currentSlug,
  children,
}: {
  currentSlug: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [prefetched, setPrefetched] = useState<PrefetchedRecipe | null>(null);
  const [isPrefetching, setIsPrefetching] = useState(false);

  const fetchAndStore = useCallback(async () => {
    if (!supabase) {
      throw new Error("Supabase client not configured");
    }

    setIsPrefetching(true);
    try {
      const slug = await fetchRandomSlug(currentSlug);
      router.prefetch(`/recipes/${slug}`);

      const { data, error } = await supabase
        .from("recipes")
        .select("image_url")
        .eq("slug", slug)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const imageUrl = resolveRecipeImageUrl(data?.image_url ?? null);
      await preloadImage(imageUrl);

      const result = { slug, imageUrl };
      setPrefetched(result);
      return result;
    } finally {
      setIsPrefetching(false);
    }
  }, [currentSlug, router]);

  useEffect(() => {
    let isActive = true;
    setPrefetched(null);

    fetchAndStore().catch((error) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to prefetch next recipe:", error);
      }
      if (isActive) {
        setPrefetched(null);
      }
    });

    return () => {
      isActive = false;
    };
  }, [fetchAndStore]);

  const getNextSlug = useCallback(async () => {
    if (prefetched) {
      const slug = prefetched.slug;
      setPrefetched(null);
      return slug;
    }

    const result = await fetchAndStore();
    setPrefetched(null);
    return result.slug;
  }, [fetchAndStore, prefetched]);

  const value = useMemo<RecipePreloadContextValue>(
    () => ({
      getNextSlug,
      prefetchedSlug: prefetched?.slug ?? null,
      isPrefetching,
    }),
    [getNextSlug, isPrefetching, prefetched],
  );

  return <RecipePreloadContext.Provider value={value}>{children}</RecipePreloadContext.Provider>;
}

export function useRecipePreload() {
  const context = useContext(RecipePreloadContext);
  if (!context) {
    throw new Error("useRecipePreload must be used within a RecipePreloadProvider");
  }
  return context;
}
