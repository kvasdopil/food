"use client";

import { PiHeartStraightLight, PiHeartStraightFill } from "react-icons/pi";
import { useFavorites } from "@/hooks/useFavorites";
import { Button } from "@/components/ui/button";

type FavoriteButtonProps = {
  slug: string;
};

export function FavoriteButton({ slug }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites(slug);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-pressed={isFavorite}
      onClick={() => toggleFavorite()}
      className="h-auto w-auto p-0 pb-0.5 transition hover:opacity-80"
      aria-label={isFavorite ? "Remove from favourites" : "Save to favourites"}
    >
      {isFavorite ? (
        <PiHeartStraightFill className="h-6 w-6 text-red-500" />
      ) : (
        <PiHeartStraightLight className="h-6 w-6 text-gray-600" />
      )}
    </Button>
  );
}
