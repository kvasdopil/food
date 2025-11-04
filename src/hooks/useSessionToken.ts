"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

/**
 * Hook for managing Supabase session token fetching
 */
export function useSessionToken() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!supabase) {
        throw new Error("Supabase client not configured");
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Unable to get session token. Please log in again.");
      }

      setIsLoading(false);
      return session.access_token;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to get session token";
      setError(errorMessage);
      setIsLoading(false);
      return null;
    }
  }, []);

  return {
    token: null, // Token is returned from fetchToken, not stored
    fetchToken,
    isLoading,
    error,
  };
}
