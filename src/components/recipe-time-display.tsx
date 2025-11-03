type RecipeTimeDisplayProps = {
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
};

/**
 * Rounds up to the nearest 15-minute interval
 */
function roundUpTo15Minutes(minutes: number): number {
  return Math.ceil(minutes / 15) * 15;
}

/**
 * Formats minutes as "15m", "30m", "45m", "1h", "1h15m", etc.
 */
function formatTime(minutes: number): string {
  if (minutes === 0) return "";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h${remainingMinutes}m`;
}

export function RecipeTimeDisplay({ prepTimeMinutes, cookTimeMinutes }: RecipeTimeDisplayProps) {
  const prep = prepTimeMinutes ?? 0;
  const cook = cookTimeMinutes ?? 0;
  const total = prep + cook;

  if (total === 0) {
    return null;
  }

  const roundedTime = roundUpTo15Minutes(total);
  const formattedTime = formatTime(roundedTime);

  return (
    <span className="absolute right-0 bottom-0 shrink-0 rounded-l-lg bg-white/30 px-2 py-0.5 text-xs font-medium text-gray-200 sm:px-2.5 sm:py-1 sm:text-sm">
      {formattedTime}
    </span>
  );
}

