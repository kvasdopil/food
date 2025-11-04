"use client";

import { HiPlus } from "react-icons/hi2";
import { Button } from "@/components/ui/button";

interface AddRecipeButtonProps {
  onClick: () => void;
}

export function AddRecipeButton({ onClick }: AddRecipeButtonProps) {
  return (
    <Button
      onClick={onClick}
      variant="ghost"
      size="icon"
      className="rounded-full"
      aria-label="Add recipe"
    >
      <HiPlus className="h-5 w-5 text-gray-600" />
    </Button>
  );
}
