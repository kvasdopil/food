"use client";

import { TAG_CHIP_PALETTE, TAG_CHIP_PALETTE_INTERACTIVE } from "@/lib/ui-constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type TagChipProps = {
  tag: string;
  variant?: "static" | "clickable" | "removable";
  index?: number;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>, tag: string) => void;
  onRemove?: (e: React.MouseEvent<HTMLButtonElement>, tag: string) => void;
  className?: string;
  "aria-label"?: string;
};

/**
 * TagChip component for displaying tags with different variants
 * - static: Non-interactive span (for recipe detail pages)
 * - clickable: Interactive button (for recipe cards, filter toggling)
 * - removable: Button with remove icon (for search bar active tags)
 */
export function TagChip({
  tag,
  variant = "static",
  index = 0,
  onClick,
  onRemove,
  className = "",
  "aria-label": ariaLabel,
}: TagChipProps) {
  const palette = variant === "static" ? TAG_CHIP_PALETTE : TAG_CHIP_PALETTE_INTERACTIVE;
  const colorClass = palette[index % palette.length];

  if (variant === "static") {
    return (
      <Badge
        variant="outline"
        className={cn("rounded-full px-3 py-1 text-sm font-medium border-0", colorClass, className)}
      >
        {tag}
      </Badge>
    );
  }

  if (variant === "removable") {
    return (
      <Badge
        asChild
        variant="outline"
        className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition hover:opacity-80 border-0", colorClass, className)}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.(e, tag);
          }}
          aria-label={ariaLabel || `Remove ${tag} filter`}
        >
          {tag}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3 w-3"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </Badge>
    );
  }

  // clickable variant
  return (
    <Badge
      asChild
      variant="outline"
      className={cn("relative z-10 cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium transition-all sm:px-3 sm:py-1 sm:text-sm border-0", colorClass, className)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick?.(e, tag);
        }}
        style={{ touchAction: "manipulation" }}
        aria-label={ariaLabel || `Filter by ${tag}`}
      >
        {tag}
      </button>
    </Badge>
  );
}

