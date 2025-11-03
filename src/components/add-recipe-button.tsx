"use client";

import { HiPlus } from "react-icons/hi2";

interface AddRecipeButtonProps {
  onClick: () => void;
}

export function AddRecipeButton({ onClick }: AddRecipeButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-transparent transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none"
      aria-label="Add recipe"
    >
      <HiPlus className="h-5 w-5 text-gray-600" />
    </button>
  );
}
