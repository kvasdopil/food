"use client";

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

  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-3 focus-within:shadow-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:outline-none hover:shadow-md">
        <HiMagnifyingGlass className="h-5 w-5 flex-shrink-0 text-gray-600" />

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
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 border-0 bg-transparent text-base shadow-none focus-visible:ring-0 placeholder:text-gray-500 sm:text-sm"
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
