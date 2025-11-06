import { Suspense } from "react";
import { randomInt } from "crypto";
import { FeedPageContent } from "./feed-page-content";
import { FeedSkeleton } from "@/components/skeletons/feed-skeleton";

// Force dynamic rendering to ensure seed is regenerated on each request
export const dynamic = "force-dynamic";

// Server component that generates a random seed for SSR
export default function FeedPage() {
  // Generate a random seed on the server for SSR
  // This ensures the same seed is used for both server render and client hydration
  const initialSeed = randomInt(0, 2147483647); // Max 32-bit integer

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white">
          <main className="mx-auto max-w-7xl sm:px-6 sm:py-6 lg:px-8">
            <FeedSkeleton count={8} />
          </main>
        </div>
      }
    >
      <FeedPageContent initialSeed={initialSeed} />
    </Suspense>
  );
}
