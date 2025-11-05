"use client";

import { PiHeartStraightLight, PiHeartStraightFill } from "react-icons/pi";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

type FavoritesToggleProps = {
  isActive: boolean;
  onToggle: () => void;
};

export function FavoritesToggle({ isActive, onToggle }: FavoritesToggleProps) {
  const { user, signInWithGoogle } = useAuth();

  const handleClick = () => {
    if (!user) {
      // If logged out, trigger login flow
      signInWithGoogle();
      return;
    }

    // If logged in, toggle favorites filter
    onToggle();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      aria-pressed={isActive}
      onClick={handleClick}
      className="h-auto w-auto p-0 transition hover:opacity-80 [&_svg]:!size-6"
      aria-label={
        isActive
          ? "Show all recipes"
          : user
            ? "Show only favorite recipes"
            : "Login to view favorites"
      }
    >
      {isActive ? (
        <PiHeartStraightFill className="h-6 w-6 text-red-500" />
      ) : (
        <PiHeartStraightLight className="h-6 w-6 text-gray-600" />
      )}
    </Button>
  );
}

