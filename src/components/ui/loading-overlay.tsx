"use client";

import { LoadingSpinner } from "./loading-spinner";

type LoadingOverlayProps = {
  message?: string;
  variant?: "full" | "badge";
  className?: string;
};

/**
 * Reusable loading overlay component
 * - full: Full overlay with centered spinner and message
 * - badge: Top-right badge with spinner and message
 */
export function LoadingOverlay({ message, variant = "full", className = "" }: LoadingOverlayProps) {
  if (variant === "badge") {
    return (
      <div
        className={`absolute top-2 right-2 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 shadow-sm ${className}`}
      >
        <LoadingSpinner size="sm" />
        {message && <span className="text-xs font-medium text-blue-700">{message}</span>}
      </div>
    );
  }

  return (
    <div
      className={`absolute inset-0 flex items-center justify-center bg-white/30 backdrop-blur-[2px] ${className}`}
    >
      <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-lg">
        <LoadingSpinner size="md" />
        {message && <span className="text-sm font-medium text-gray-700">{message}</span>}
      </div>
    </div>
  );
}
