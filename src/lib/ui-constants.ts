/**
 * Shared UI constants for consistent styling across the application
 */

/**
 * Tag chip color palette for static tags (no hover effects)
 */
export const TAG_CHIP_PALETTE = [
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
] as const;

/**
 * Tag chip color palette for interactive tags (with hover effects)
 */
export const TAG_CHIP_PALETTE_INTERACTIVE = [
  "bg-amber-100 text-amber-700 hover:bg-amber-200 hover:shadow-md",
  "bg-sky-100 text-sky-700 hover:bg-sky-200 hover:shadow-md",
  "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:shadow-md",
  "bg-violet-100 text-violet-700 hover:bg-violet-200 hover:shadow-md",
] as const;

/**
 * Recipe grid layout classes for responsive grid display
 */
export const RECIPE_GRID_CLASSES =
  "grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4";
