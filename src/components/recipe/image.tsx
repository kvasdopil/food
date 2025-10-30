import NextImage from "next/image";

import { ShareRecipeButton } from "@/components/share-recipe-button";
import { resolveRecipeImageUrl } from "@/lib/resolve-recipe-image-url";

type RecipeImageProps = {
  name: string;
  imageUrl: string | null;
  slug: string;
};

export function RecipeImage({ name, imageUrl, slug }: RecipeImageProps) {
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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent px-5 pt-16 pb-6">
        <h1 className="text-3xl font-semibold text-white drop-shadow-sm md:text-4xl">{name}</h1>
      </div>
    </figure>
  );
}
