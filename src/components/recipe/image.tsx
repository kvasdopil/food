import NextImage from "next/image";

import { ShareRecipeButton } from "@/components/share-recipe-button";
import { resolveRecipeImageUrl } from "@/lib/resolve-recipe-image-url";
import { RecipeTimeDisplay } from "@/components/recipe-time-display";

type RecipeImageProps = {
  name: string;
  imageUrl: string | null;
  slug: string;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
};

export function RecipeImage({ name, imageUrl, slug, prepTimeMinutes, cookTimeMinutes }: RecipeImageProps) {
  const resolvedImageUrl = resolveRecipeImageUrl(imageUrl);

  return (
    <figure className="relative aspect-[4/3] w-full overflow-hidden md:aspect-[16/9] lg:h-[520px]">
      {resolvedImageUrl ? (
        <NextImage
          src={resolvedImageUrl}
          alt={name}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 640px"
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-200 via-slate-100 to-slate-300" />
      )}

      <div className="absolute top-4 right-4 flex items-center gap-3">
        <ShareRecipeButton slug={slug} title={name} variant="icon" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pt-16 pb-6">
        <div className="relative flex items-center gap-2 px-5">
          <h1 className="flex-1 pr-20 text-3xl font-semibold text-white drop-shadow-sm sm:pr-24 md:text-4xl">{name}</h1>
          <RecipeTimeDisplay prepTimeMinutes={prepTimeMinutes} cookTimeMinutes={cookTimeMinutes} />
        </div>
      </div>
    </figure>
  );
}
