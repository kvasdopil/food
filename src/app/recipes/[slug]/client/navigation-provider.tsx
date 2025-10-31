"use client";

import { createContext, useCallback, useContext } from "react";

import { fetchRandomSlug } from "@/lib/random-recipe";
import { getNextSlugFromHistory, syncHistoryWithCurrentSlug } from "./recipe-history";

type NavigationContextValue = {
  getNextSlug: () => Promise<string>;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

type NavigationProviderProps = {
  currentSlug: string;
  children: React.ReactNode;
};

export function NavigationProvider({ currentSlug, children }: NavigationProviderProps) {
  const getNextSlug = useCallback(async () => {
    // Check forward history first (no API call needed if available)
    if (typeof window !== "undefined") {
      const snapshot = syncHistoryWithCurrentSlug(currentSlug);
      const forwardSlug = getNextSlugFromHistory(snapshot);
      if (forwardSlug) {
        console.log("[navigation] Using forward history instead of API call", forwardSlug);
        return forwardSlug;
      }
    }

    // Only call API when there's no forward history
    return fetchRandomSlug(currentSlug);
  }, [currentSlug]);

  return (
    <NavigationContext.Provider value={{ getNextSlug }}>{children}</NavigationContext.Provider>
  );
}

export function useRecipeNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useRecipeNavigation must be used within a NavigationProvider");
  }
  return context;
}
