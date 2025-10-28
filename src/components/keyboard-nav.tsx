'use client';

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

export function KeyboardNav() {
  const router = useRouter();

  const handleKeydown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore when focus is inside editable inputs to avoid hijacking typing.
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isTyping) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        router.push("/?nav=previous");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        router.push("/?nav=next");
      }
    },
    [router],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [handleKeydown]);

  return null;
}

