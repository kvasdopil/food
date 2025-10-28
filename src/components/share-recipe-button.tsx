'use client';

import type { SVGProps } from "react";
import { useCallback, useMemo, useState } from "react";

type ShareRecipeButtonProps = {
  slug: string;
  title: string;
  variant?: "button" | "icon";
};

function ShareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="m16 6-4-4-4 4" />
      <path d="M12 2v14" />
    </svg>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function ShareRecipeButton({
  slug,
  title,
  variant = "button",
}: ShareRecipeButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const origin = window.location.origin;
    return `${origin}/recipes/${slug}`;
  }, [slug]);

  const resetStatus = useCallback(() => {
    window.setTimeout(() => setStatus("idle"), 2500);
  }, []);

  const handleShare = useCallback(async () => {
    const url = shareUrl || `${window.location.origin}/recipes/${slug}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          url,
        });
        return;
      }

      await navigator.clipboard.writeText(url);
      setStatus("copied");
      resetStatus();
    } catch (error) {
      console.error("Failed to share recipe", error);
      setStatus("error");
      resetStatus();
    }
  }, [shareUrl, slug, title, resetStatus]);

  if (variant === "icon") {
    const icon =
      status === "copied" ? (
        <CheckIcon className="h-4 w-4" />
      ) : (
        <ShareIcon className="h-4 w-4" />
      );

    return (
      <button
        type="button"
        onClick={handleShare}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-slate-900 shadow-sm ring-1 ring-white/60 transition hover:bg-white hover:text-emerald-600 dark:bg-slate-900/80 dark:text-slate-100 dark:ring-slate-700 dark:hover:text-emerald-300"
        aria-label="Share recipe"
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-200 dark:hover:bg-emerald-400/20"
    >
      {status === "copied"
        ? "Link copied!"
        : status === "error"
        ? "Share failed"
        : "Share recipe"}
    </button>
  );
}
