'use client';

import { useState } from "react";

export function FavoriteButton() {
  const [liked, setLiked] = useState(false);

  return (
    <button
      type="button"
      aria-pressed={liked}
      onClick={() => setLiked((prev) => !prev)}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-900 shadow-sm ring-1 ring-white/60 transition hover:bg-white ${
        liked ? "text-rose-500" : "hover:text-rose-500 dark:hover:text-rose-400"
      } dark:bg-slate-900/80 dark:text-slate-100 dark:ring-slate-700`}
      aria-label={liked ? "Remove from favourites" : "Save to favourites"}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={liked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={liked ? 1.5 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <path d="M19 14.5 12 21l-7-6.5A4.5 4.5 0 0 1 12 6.7a4.5 4.5 0 0 1 7 7.8Z" />
      </svg>
    </button>
  );
}

