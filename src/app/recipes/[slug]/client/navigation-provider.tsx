"use client";

import { createContext, useCallback, useContext } from "react";

import { fetchRandomSlug } from "@/lib/random-recipe";

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
    return fetchRandomSlug(currentSlug);
  }, [currentSlug]);

  return <NavigationContext.Provider value={{ getNextSlug }}>{children}</NavigationContext.Provider>;
}

export function useRecipeNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useRecipeNavigation must be used within a NavigationProvider");
  }
  return context;
}
