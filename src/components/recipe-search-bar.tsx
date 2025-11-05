"use client";

import { useState, useRef, useEffect } from "react";
import { HiMagnifyingGlass } from "react-icons/hi2";
import { AiOutlineClose } from "react-icons/ai";
import { TagChip } from "@/components/tag-chip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface RecipeSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  activeTags?: string[];
  onRemoveTag?: (tag: string) => void;
  onClearAllTags?: () => void;
}

export function RecipeSearchBar({
  value,
  onChange,
  placeholder = "Search recipes by name or tags...",
  activeTags = [],
  onRemoveTag,
  onClearAllTags,
}: RecipeSearchBarProps) {
  const hasTags = activeTags.length > 0;
  const [isMobile, setIsMobile] = useState(true);
  const [inputWidth, setInputWidth] = useState<number>(200);
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  // Detect if we're on mobile (less than sm breakpoint: 640px)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Show placeholder only on desktop (never on mobile)
  const showPlaceholder = !isMobile;

  // Measure text width to set input width
  useEffect(() => {
    const measureWidth = () => {
      if (measureRef.current && inputRef.current) {
        const measureWidth = measureRef.current.offsetWidth;
        // Get computed styles to account for padding
        const computedStyle = window.getComputedStyle(inputRef.current);
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
        const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
        // Set minimum width for placeholder visibility, or measured width + padding
        const minWidth = showPlaceholder && !value ? 250 : 20;
        const newWidth = Math.max(minWidth, measureWidth + paddingLeft + paddingRight);
        setInputWidth(newWidth);
      }
    };

    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(measureWidth);
  }, [value, isMobile, showPlaceholder]);

  const handleMagnifierClick = () => {
    inputRef.current?.focus();
  };

  const displayValue = value || (showPlaceholder ? "" : placeholder);
  const showClearButton = value.length > 0;

  return (
    <div className="inline-flex">
      <div className="flex items-center gap-2 rounded-full bg-white my-3 px-3 py-0 hover:bg-gray-100">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleMagnifierClick}
            className="flex-shrink-0 cursor-pointer text-gray-600 hover:text-gray-800"
            aria-label="Focus search"
          >
            <HiMagnifyingGlass className="h-5 w-5" />
          </button>

          {hasTags && (
            <div className="flex flex-shrink-0 items-center gap-2">
              {activeTags.map((tag, index) => (
                <TagChip
                  key={tag}
                  tag={tag}
                  variant="removable"
                  index={index}
                  onRemove={(e, tag) => {
                    e.stopPropagation();
                    onRemoveTag?.(tag);
                  }}
                />
              ))}
            </div>
          )}

          <div className="relative inline-flex items-center">
            {/* Hidden span to measure text width - matches input font styling */}
            <span
              ref={measureRef}
              className="invisible absolute whitespace-pre text-base sm:text-sm"
              aria-hidden="true"
            >
              {displayValue || "\u00A0"}
            </span>

            <Input
              ref={inputRef}
              type="text"
              placeholder={showPlaceholder ? placeholder : ""}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              style={{
                width: inputWidth > 0 ? `${inputWidth}px` : "auto",
                minWidth: showPlaceholder && !value ? "250px" : "20px",
              }}
              className="border-0 bg-transparent text-base shadow-none outline-none ring-0 placeholder:text-gray-500 focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm sm:placeholder:text-gray-500 pl-1 pr-0"
            />
          </div>
        </div>

        {showClearButton && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              onChange("");
              onClearAllTags?.();
            }}
            className="h-auto w-auto flex-shrink-0 p-0 text-gray-600 hover:text-gray-800"
            aria-label="Clear search and filters"
          >
            <AiOutlineClose className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
