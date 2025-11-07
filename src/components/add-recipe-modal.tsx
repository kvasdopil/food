"use client";

import { RecipeModal } from "@/components/recipe-modal";

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddRecipeModal({ isOpen, onClose }: AddRecipeModalProps) {
  return <RecipeModal isOpen={isOpen} onClose={onClose} mode="create" />;
}
