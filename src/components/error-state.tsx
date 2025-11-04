"use client";

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
          <button
            onClick={onRetry}
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

