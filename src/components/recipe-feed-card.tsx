"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { resolveRecipeImageUrl } from "@/lib/resolve-recipe-image-url";

type RecipeFeedCardProps = {
  slug: string;
  name: string;
  description: string | null;
  tags: string[];
  imageUrl: string | null;
};

const FAVORITES_STORAGE_KEY = "recipe-favorites";
const chipPalette = [
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
];

function getFavoriteStatus(slug: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const favorites = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
    return favorites.includes(slug);
  } catch {
    return false;
  }
}

function toggleFavorite(slug: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const favorites = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
    const index = favorites.indexOf(slug);
    if (index > -1) {
      favorites.splice(index, 1);
    } else {
      favorites.push(slug);
    }
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    return favorites.includes(slug);
  } catch {
    return false;
  }
}

export function RecipeFeedCard({ slug, name, description, tags, imageUrl }: RecipeFeedCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const resolvedImageUrl = resolveRecipeImageUrl(imageUrl);

  useEffect(() => {
    setIsLiked(getFavoriteStatus(slug));
  }, [slug]);

  const handleLikeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLiked(toggleFavorite(slug));
  };

  return (
    <Link
      href={`/recipes/${slug}`}
      className="block w-full cursor-pointer overflow-hidden bg-white transition-opacity hover:opacity-95 sm:rounded-lg sm:shadow-md lg:shadow-lg"
    >
      <figure className="relative aspect-[4/3] w-full overflow-hidden">
        {resolvedImageUrl ? (
          <NextImage
            src={resolvedImageUrl}
            alt={name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 16vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-200 via-slate-100 to-slate-300" />
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent px-4 pt-12 pb-4 sm:px-5 sm:pt-16 sm:pb-3">
          <h2 className="text-3xl font-semibold text-white drop-shadow-sm sm:text-base lg:text-lg">
            {name}
          </h2>
        </div>
      </figure>

      <div className="space-y-4 px-4 pt-4 sm:px-5 sm:pt-6">
        {description && <p className="line-clamp-2 text-sm text-slate-600">{description}</p>}

        <div className="flex flex-wrap items-center gap-2 pb-4 sm:pb-6">
          <button
            type="button"
            onClick={handleLikeClick}
            className="inline-flex cursor-pointer items-center justify-center pb-0.5 transition hover:opacity-80"
            aria-label={isLiked ? "Remove from favourites" : "Save to favourites"}
            aria-pressed={isLiked}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill={isLiked ? "#ef4444" : "none"}
              stroke={isLiked ? "#ef4444" : "#6b7280"}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 sm:h-7 sm:w-7"
            >
              <path d="M19 14.5 12 21l-7-6.5A4.5 4.5 0 0 1 12 6.7a4.5 4.5 0 0 1 7 7.8Z" />
            </svg>
          </button>
          {tags.map((tag, index) => (
            <span
              key={tag}
              className={`rounded-full px-2 py-0.5 text-xs font-medium sm:px-3 sm:py-1 sm:text-sm ${chipPalette[index % chipPalette.length]}`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
