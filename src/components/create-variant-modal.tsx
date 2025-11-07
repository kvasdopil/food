"use client";

import { RecipeModal } from "@/components/recipe-modal";
import type { RecipeData } from "@/lib/fetch-recipe-data";

interface CreateVariantModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseRecipe: RecipeData;
  variationOf: string | null;
}

export function CreateVariantModal({
  isOpen,
  onClose,
  baseRecipe,
  variationOf,
}: CreateVariantModalProps) {
  return (
    <RecipeModal
      isOpen={isOpen}
      onClose={onClose}
      baseRecipe={baseRecipe}
      variationOf={variationOf}
      mode="modify"
    />
  );
}

