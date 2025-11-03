import { Skeleton } from "./skeleton";

type FeedSkeletonProps = {
  count?: number;
};

export function FeedSkeleton({ count = 8 }: FeedSkeletonProps) {
  return (
    <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="relative block w-full overflow-hidden bg-white sm:rounded-lg sm:shadow-md lg:shadow-lg"
        >
          {/* Image skeleton */}
          <div className="relative aspect-[4/3] w-full overflow-hidden">
            <Skeleton className="absolute inset-0" />
            {/* Title overlay skeleton */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent px-4 pt-12 pb-4 sm:px-5 sm:pt-16 sm:pb-3">
              <Skeleton className="h-8 w-3/4 sm:h-5 lg:h-6" />
            </div>
          </div>

          {/* Description and tags section */}
          <div className="space-y-4 px-4 pt-4 sm:px-5 sm:pt-6">
            {/* Description skeleton - 2 lines */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>

            {/* Tags and favorite button skeleton */}
            <div className="flex flex-wrap items-center gap-2 pb-4 sm:pb-6">
              {/* Favorite button skeleton */}
              <Skeleton className="h-6 w-6 rounded-full sm:h-7 sm:w-7" />
              {/* Tag chips skeleton */}
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
