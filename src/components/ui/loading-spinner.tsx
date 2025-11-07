"use client";

type LoadingSpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * Reusable loading spinner component
 */
export function LoadingSpinner({ size = "md", className = "" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-3 w-3 border-2",
    md: "h-4 w-4 border-2",
    lg: "h-6 w-6 border-2",
  };

  return (
    <span
      className={`${sizeClasses[size]} animate-spin rounded-full border-blue-600 border-t-transparent ${className}`}
      aria-label="Loading"
    />
  );
}
