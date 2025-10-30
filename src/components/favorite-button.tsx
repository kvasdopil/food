"use client";

import { useState } from "react";

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
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={liked ? "#ef4444" : "none"}
        stroke={liked ? "#ef4444" : "#6b7280"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-7 w-7"
      >
        <path d="M19 14.5 12 21l-7-6.5A4.5 4.5 0 0 1 12 6.7a4.5 4.5 0 0 1 7 7.8Z" />
      </svg>
    </button>
  );
}
