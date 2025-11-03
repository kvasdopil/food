// Base skeleton component with animated gradient background
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`skeleton-shimmer rounded bg-gray-200 ${className}`}
    />
  );
}

