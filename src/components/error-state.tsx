"use client";

import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  error: string;
  onRetry?: () => void;
  className?: string;
};

/**
 * ErrorState component for displaying error messages with optional retry button
 */
export function ErrorState({ error, onRetry, className = "" }: ErrorStateProps) {
  return (
    <div className={`flex items-center justify-center py-32 ${className}`}>
      <div className="text-center">
        <p className="text-lg text-red-600">{error}</p>
        {onRetry && (
          <Button onClick={onRetry} className="mt-4">
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
