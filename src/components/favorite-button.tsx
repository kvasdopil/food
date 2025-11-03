"use client";

import { useState } from "react";
import { PiHeartStraightLight, PiHeartStraightFill } from "react-icons/pi";

export function FavoriteButton() {
  const [liked, setLiked] = useState(false);

  return (
    <button
      type="button"
      aria-pressed={liked}
      onClick={() => setLiked((prev) => !prev)}
      className="inline-flex cursor-pointer items-center justify-center pb-0.5 transition hover:opacity-80"
      aria-label={liked ? "Remove from favourites" : "Save to favourites"}
    >
      {liked ? (
        <PiHeartStraightFill className="h-6 w-6 text-red-500" />
      ) : (
        <PiHeartStraightLight className="h-6 w-6 text-gray-600" />
      )}
    </button>
  );
}
