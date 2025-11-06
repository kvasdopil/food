"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type VariantsDropdownProps = {
  variationOf: string | null;
  variants: Array<{ slug: string; name: string }>;
};

export function VariantsDropdown({ variationOf, variants }: VariantsDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Ensure component is mounted before rendering interactive elements
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Don't show if no variationOf or less than 2 variants (including current)
  if (!variationOf || variants.length === 0) {
    return null;
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isMounted) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      // Use a small delay to avoid closing immediately when opening
      const timeoutId = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("click", handleClickOutside);
      }, 0);

      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("click", handleClickOutside);
      };
    }
  }, [isOpen, isMounted]);

  const handleVariantClick = (slug: string) => {
    setIsOpen(false);
    router.push(`/recipes/${slug}`);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const message = variants.length === 1
    ? "This meal has another variant"
    : `This meal has ${variants.length} more variants`;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        aria-expanded={isMounted ? isOpen : false}
        aria-haspopup="listbox"
      >
        <span>{message}</span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", isMounted && isOpen && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {isMounted && isOpen && (
        <div className="absolute top-full left-0 z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {variants.map((variant) => (
            <button
              key={variant.slug}
              type="button"
              onClick={() => handleVariantClick(variant.slug)}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100"
            >
              {variant.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

