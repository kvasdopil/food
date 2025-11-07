"use client";

import { useState } from "react";
import { FavoriteButton } from "@/components/favorite-button";
import { TagChip } from "@/components/tag-chip";
import { buildFeedUrlWithTagsAndSearch } from "@/lib/tag-utils";
import { VersionsScroll } from "./versions-scroll";
import { RecipeModal } from "@/components/recipe-modal";
import { useAuth } from "@/hooks/useAuth";
import type { RecipeData } from "@/lib/fetch-recipe-data";

type DescriptionProps = {
  slug: string;
  description: string | null;
  tags: string[];
  authorName?: string | null;
  variationOf?: string | null;
  variants?: Array<{ slug: string; name: string; imageUrl: string | null }>;
  recipeData?: RecipeData | null;
};

export function Description({
  slug,
  description,
  tags,
  authorName,
  variationOf,
  variants = [],
  recipeData,
}: DescriptionProps) {
  const { session, signInWithGoogle } = useAuth();
  const [isCreateVariantModalOpen, setIsCreateVariantModalOpen] = useState(false);

  const handleCreateVariantClick = () => {
    if (!session) {
      signInWithGoogle();
      return;
    }
    setIsCreateVariantModalOpen(true);
  };

  // Determine the base meal name for variation
  // If recipe already has variationOf, use that; otherwise use recipe name
  const baseVariationOf = variationOf || recipeData?.name || null;

  // Show variations section if we have recipeData (to show create version button)
  // or if there are existing variants
  const shouldShowVariations = recipeData || (variationOf && variants.length > 0);

  if (!description && tags.length === 0 && !authorName && !shouldShowVariations && !recipeData) {
    return null;
  }

  return (
    <>
      <section className="space-y-6 px-5 pt-8 sm:px-8">
        {description ? <p className="text-base text-slate-600">{description}</p> : null}
        {authorName ? <p className="text-sm text-slate-500 italic">by {authorName}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <FavoriteButton slug={slug} />
          {tags.map((tag, index) => {
            const href = buildFeedUrlWithTagsAndSearch([tag.toLowerCase()]);
            return <TagChip key={tag} tag={tag} variant="link" href={href} index={index} />;
          })}
        </div>

        {shouldShowVariations && recipeData && (
          <div>
            <VersionsScroll variants={variants} onCreateVariant={handleCreateVariantClick} />
          </div>
        )}
      </section>

      {recipeData && (
        <RecipeModal
          isOpen={isCreateVariantModalOpen}
          onClose={() => setIsCreateVariantModalOpen(false)}
          baseRecipe={recipeData}
          variationOf={baseVariationOf}
          mode="modify"
        />
      )}
    </>
  );
}
