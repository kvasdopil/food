"use client";

import { FeedSkeleton } from "@/components/skeletons/feed-skeleton";
import { ErrorState } from "@/components/error-state";

type FeedErrorStateProps = {
  error: string;
  onRetry?: () => void;
};

/**
 * FeedErrorState component for displaying error states in the feed
 */
export function FeedErrorState({ error, onRetry }: FeedErrorStateProps) {
  return <ErrorState error={error} onRetry={onRetry} />;
}

type FeedEmptyStateProps = {
  message?: string;
  className?: string;
};

/**
 * FeedEmptyState component for displaying empty state in the feed
 */
export function FeedEmptyState({
  message = "No recipes found",
  className = "",
}: FeedEmptyStateProps) {
  return (
    <div className={`flex items-center justify-center py-32 ${className}`}>
      <p className="text-lg text-gray-600">{message}</p>
    </div>
  );
}

type FeedLoadingMoreProps = {
  count?: number;
  className?: string;
};

/**
 * FeedLoadingMore component for displaying loading skeletons while loading more recipes
 */
export function FeedLoadingMore({ count = 4, className = "" }: FeedLoadingMoreProps) {
  return (
    <div className={`mt-6 ${className}`}>
      <FeedSkeleton count={count} />
    </div>
  );
}

type FeedEndStateProps = {
  message?: string;
  className?: string;
};

/**
 * FeedEndState component for displaying end-of-feed message
 */
export function FeedEndState({
  message = "No more recipes",
  className = "",
}: FeedEndStateProps) {
  return (
    <div className={`flex items-center justify-center py-8 ${className}`}>
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
}

