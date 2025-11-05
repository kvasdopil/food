"use client";

import { useState } from "react";
import { PiHeartStraightLight, PiHeartStraightFill } from "react-icons/pi";
import { useFavorites } from "@/hooks/useFavorites";
import { Button } from "@/components/ui/button";

type FavoriteButtonProps = {
  slug: string;
};

export function FavoriteButton({ slug }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite, isLoading } = useFavorites(slug);
  const [isToggling, setIsToggling] = useState(false);

  const handleClick = async () => {
    if (isToggling || isLoading) return;

    setIsToggling(true);
    try {
      await toggleFavorite();
    } catch (err) {
      // Error is already handled in the hook and logged
      // Check if it's an auth error that requires user action
      const errorMessage = err instanceof Error ? err.message : "Failed to toggle favorite";
      if (errorMessage.includes("Session expired") || errorMessage.includes("Authentication")) {
        // Auth errors are handled by the hook, but we log them for debugging
        console.warn("Authentication required for favorite action:", errorMessage);
      } else {
        console.error("Failed to toggle favorite:", err);
      }
    } finally {
      setIsToggling(false);
    }
  };

  const isButtonLoading = isLoading || isToggling;
  const showLoading = isButtonLoading && !isFavorite;

  return (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={isFavorite}
      onClick={handleClick}
      disabled={isButtonLoading}
      className="h-auto w-auto p-0 pb-0.5 transition hover:opacity-80 disabled:opacity-50 [&_svg]:!size-6"
      aria-label={
        isFavorite
          ? "Remove from favourites"
          : isButtonLoading
            ? "Loading..."
            : "Save to favourites"
      }
    >
      {isFavorite ? (
        <PiHeartStraightFill className="h-6 w-6 text-red-500" />
      ) : (
        <PiHeartStraightLight
          className={`h-6 w-6 text-gray-600 ${showLoading ? "opacity-50" : ""}`}
        />
      )}
    </Button>
  );
}
