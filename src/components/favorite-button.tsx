"use client";

import { PiHeartStraightLight, PiHeartStraightFill } from "react-icons/pi";
import { useFavorites } from "@/hooks/useFavorites";

type FavoriteButtonProps = {
  slug: string;
};

export function FavoriteButton({ slug }: FavoriteButtonProps) {
  const { isFavorite, toggleFavorite } = useFavorites(slug);

  return (
    <button
      type="button"
      aria-pressed={isFavorite}
      onClick={() => toggleFavorite()}
      className="inline-flex cursor-pointer items-center justify-center pb-0.5 transition hover:opacity-80"
      aria-label={isFavorite ? "Remove from favourites" : "Save to favourites"}
    >
      {isFavorite ? (
        <PiHeartStraightFill className="h-6 w-6 text-red-500" />
      ) : (
        <PiHeartStraightLight className="h-6 w-6 text-gray-600" />
      )}
    </button>
  );
}
