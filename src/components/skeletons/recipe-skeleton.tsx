import { Skeleton } from "./skeleton";

type RecipeSkeletonProps = {
  showOnlyIngredientsAndInstructions?: boolean;
};

export function RecipeSkeleton({
  showOnlyIngredientsAndInstructions = false,
}: RecipeSkeletonProps) {
  // If showing only ingredients and instructions, skip the image/description skeleton
  if (showOnlyIngredientsAndInstructions) {
    return (
      <>
        {/* Ingredients section skeleton */}
        <section className="mt-8 space-y-5 px-5 sm:px-10 lg:px-12">
          <Skeleton className="h-7 w-32" />
          <ul className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <li key={index} className="relative flex flex-col gap-1 rounded-lg pl-2">
                <div className="pl-6">
                  <div className="flex items-baseline gap-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  {/* Optional notes skeleton - show for some items */}
                  {index % 3 === 0 && <Skeleton className="mt-1 h-3 w-24" />}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Instructions section skeleton */}
        <section className="mt-8 space-y-5 px-5 pb-12 sm:px-10 lg:px-12">
          <Skeleton className="h-7 w-32" />
          <ol className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <li key={index} className="flex items-start gap-3">
                {/* Step number skeleton */}
                <Skeleton className="mt-0.5 h-6 w-5 flex-shrink-0" />
                {/* Step text skeleton - variable width */}
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className={index % 2 === 0 ? "h-4 w-full" : "h-4 w-5/6"} />
                  {index % 3 === 0 && <Skeleton className="h-4 w-4/5" />}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </>
    );
  }

  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <article className="flex w-full flex-col bg-white text-base leading-relaxed text-slate-600">
        {/* Image skeleton */}
        <figure className="relative aspect-[4/3] w-full overflow-hidden md:aspect-[16/9] lg:h-[520px]">
          <Skeleton className="absolute inset-0" />
          {/* Share button skeleton */}
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
          {/* Title overlay skeleton */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent px-5 pt-16 pb-6">
            <Skeleton className="h-10 w-3/4 md:h-12" />
          </div>
        </figure>

        {/* Description section skeleton */}
        <section className="space-y-6 px-5 pt-8 sm:px-8">
          {/* Description text skeleton - 3 lines */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
          </div>

          {/* Tags and favorite button skeleton */}
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-14 rounded-full" />
          </div>
        </section>

        {/* Ingredients section skeleton */}
        <section className="mt-8 space-y-5 px-5 sm:px-10 lg:px-12">
          <Skeleton className="h-7 w-32" />
          <ul className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <li key={index} className="relative flex flex-col gap-1 rounded-lg pl-2">
                <div className="pl-6">
                  <div className="flex items-baseline gap-2">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  {/* Optional notes skeleton - show for some items */}
                  {index % 3 === 0 && <Skeleton className="mt-1 h-3 w-24" />}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Instructions section skeleton */}
        <section className="mt-8 space-y-5 px-5 pb-12 sm:px-10 lg:px-12">
          <Skeleton className="h-7 w-32" />
          <ol className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <li key={index} className="flex items-start gap-3">
                {/* Step number skeleton */}
                <Skeleton className="mt-0.5 h-6 w-5 flex-shrink-0" />
                {/* Step text skeleton - variable width */}
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className={index % 2 === 0 ? "h-4 w-full" : "h-4 w-5/6"} />
                  {index % 3 === 0 && <Skeleton className="h-4 w-4/5" />}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </article>
    </div>
  );
}
