"use client";

import Link from "next/link";
import NextImage from "next/image";
import { resolveRecipeImageUrl } from "@/lib/resolve-recipe-image-url";

type VersionsScrollProps = {
  variants: Array<{ slug: string; name: string; imageUrl: string | null }>;
  onCreateVariant?: () => void;
};

export function VersionsScroll({ variants, onCreateVariant }: VersionsScrollProps) {
  if (variants.length === 0 && !onCreateVariant) {
    return null;
  }

  const message =
    variants.length === 1
      ? "This meal has another version"
      : `This meal has ${variants.length} more versions`;

  return (
    <div className="space-y-3">
      {variants.length > 0 && <h3 className="text-sm font-semibold text-slate-700">{message}</h3>}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {variants.map((variant) => {
          const resolvedImageUrl = resolveRecipeImageUrl(variant.imageUrl);
          return (
            <Link
              key={variant.slug}
              href={`/recipes/${variant.slug}`}
              className="group relative flex min-w-[140px] flex-shrink-0 cursor-pointer overflow-hidden rounded-lg shadow-sm transition-shadow hover:shadow-md"
            >
              <figure className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                {resolvedImageUrl ? (
                  <NextImage
                    src={resolvedImageUrl}
                    alt={variant.name}
                    fill
                    sizes="140px"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200">
                    <div className="animate-shimmer absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent bg-[length:200%_100%]" />
                  </div>
                )}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pt-8 pb-2">
                  <div className="relative px-2">
                    <h3 className="line-clamp-2 text-xs font-semibold text-white drop-shadow-sm">
                      {variant.name}
                    </h3>
                  </div>
                </div>
              </figure>
            </Link>
          );
        })}
        {onCreateVariant && (
          <button
            onClick={onCreateVariant}
            className="group relative flex min-w-[140px] flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-slate-400 hover:bg-slate-100"
          >
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
              <svg
                className="h-8 w-8 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="text-xs font-medium text-slate-600">Create variant</span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

