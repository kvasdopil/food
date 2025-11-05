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
  const [isFocused, setIsFocused] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect if we're on mobile (less than sm breakpoint: 640px)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleMagnifierClick = () => {
    inputRef.current?.focus();
  };

  // Show placeholder on desktop always, or on mobile when focused
  const showPlaceholder = !isMobile || isFocused;

  return (
    <div>
      <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-3 hover:shadow-md">
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

        <Input
          ref={inputRef}
          type="text"
          placeholder={showPlaceholder ? placeholder : ""}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="flex-1 border-0 bg-transparent text-base shadow-none outline-none ring-0 placeholder:text-gray-500 focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm sm:placeholder:text-gray-500"
        />

        {(value || hasTags) && (
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
