"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import NextImage from "next/image";
import { PiHeartStraightLight, PiHeartStraightFill } from "react-icons/pi";
import { resolveRecipeImageUrl } from "@/lib/resolve-recipe-image-url";
import { toggleTagInUrl } from "@/lib/tag-utils";
import { RecipeTimeDisplay } from "@/components/recipe-time-display";
import { useFavorites } from "@/hooks/useFavorites";
import { TagChip } from "@/components/tag-chip";

type RecipeFeedCardProps = {
  slug: string;
  name: string;
  description: string | null;
  tags: string[];
  imageUrl: string | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
};

export function RecipeFeedCard({
  slug,
  name,
  description,
  tags,
  imageUrl,
  prepTimeMinutes,
  cookTimeMinutes,
}: RecipeFeedCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites(slug);
  const router = useRouter();
  const resolvedImageUrl = resolveRecipeImageUrl(imageUrl);

  const handleLikeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite();
  };

  const handleTagClick = (e: React.MouseEvent<HTMLButtonElement>, tag: string) => {
    e.preventDefault();
    e.stopPropagation();
    const url = toggleTagInUrl(tag);
    router.push(url);
  };

  return (
    <Link
      href={`/recipes/${slug}`}
      className="relative block w-full cursor-pointer overflow-hidden bg-white transition-opacity hover:opacity-95 sm:rounded-lg sm:shadow-md lg:shadow-lg"
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
          <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200">
            <div className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent bg-[length:200%_100%]" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pt-12 pb-4 sm:pt-16 sm:pb-3">
          <div className="relative flex items-center gap-2 px-4 sm:px-5">
            <h2 className="flex-1 pr-20 text-3xl font-semibold text-white drop-shadow-sm sm:pr-24 sm:text-base lg:text-lg">
              {name}
            </h2>
            <RecipeTimeDisplay
              prepTimeMinutes={prepTimeMinutes}
              cookTimeMinutes={cookTimeMinutes}
            />
          </div>
        </div>
      </figure>

      <div className="space-y-4 px-4 pt-4 sm:px-5 sm:pt-6">
        {description && <p className="line-clamp-2 text-sm text-slate-600">{description}</p>}

        <div
          className="flex flex-wrap items-center gap-2 pb-4 sm:pb-6"
          onClick={(e) => {
            // Stop clicks in the tags/favorite area from triggering the parent Link
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            // Stop touch events from propagating to parent Link on mobile
            e.stopPropagation();
          }}
        >
          <button
            type="button"
            onClick={handleLikeClick}
            className="inline-flex cursor-pointer items-center justify-center pb-0.5 transition hover:opacity-80"
            aria-label={isFavorite ? "Remove from favourites" : "Save to favourites"}
            aria-pressed={isFavorite}
          >
            {isFavorite ? (
              <PiHeartStraightFill className="h-6 w-6 text-red-500" />
            ) : (
              <PiHeartStraightLight className="h-6 w-6 text-gray-600" />
            )}
          </button>
          {tags.map((tag, index) => (
            <TagChip
              key={tag}
              tag={tag}
              variant="clickable"
              index={index}
              onClick={(e, tag) => handleTagClick(e, tag)}
            />
          ))}
        </div>
      </div>
    </Link>
  );
}
