"use client";

import { HiMagnifyingGlass } from "react-icons/hi2";
import { AiOutlineClose } from "react-icons/ai";

interface RecipeSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  activeTags?: string[];
  onRemoveTag?: (tag: string) => void;
  onClearAllTags?: () => void;
}

const chipPalette = [
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
];

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
        <HiMagnifyingGlass className="h-5 w-5 flex-shrink-0 text-gray-400" />

        {hasTags && (
          <div className="flex flex-shrink-0 items-center gap-2">
            {activeTags.map((tag, index) => (
              <button
                key={tag}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveTag?.(tag);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition hover:opacity-80 ${chipPalette[index % chipPalette.length]}`}
              >
                {tag}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            ))}
          </div>
        )}

        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-base text-gray-900 placeholder-gray-500 focus:outline-none sm:text-sm"
        />

        {(value || hasTags) && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              onClearAllTags?.();
            }}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            aria-label="Clear search and filters"
          >
            <AiOutlineClose className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
