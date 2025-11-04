"use client";

import type { SVGProps } from "react";
import { useCallback, useMemo, useState } from "react";
import { FaShare } from "react-icons/fa";
import { Button } from "@/components/ui/button";

type ShareRecipeButtonProps = {
  slug: string;
  title: string;
  variant?: "button" | "icon";
};

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

export function ShareRecipeButton({ slug, title, variant = "button" }: ShareRecipeButtonProps) {
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
        <CheckIcon className="h-[1.3rem] w-[1.3rem]" />
      ) : (
        <FaShare className="h-[1.3rem] w-[1.3rem]" />
      );

    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleShare}
        className="h-10 w-10 text-white transition hover:opacity-80"
        aria-label="Share recipe"
      >
        {icon}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleShare}
      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-200 dark:hover:bg-emerald-400/20"
    >
      {status === "copied" ? "Link copied!" : status === "error" ? "Share failed" : "Share recipe"}
    </Button>
  );
}
