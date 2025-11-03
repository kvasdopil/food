"use client";

import { HiMagnifyingGlass } from "react-icons/hi2";
import { AiOutlineClose } from "react-icons/ai";

interface RecipeSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RecipeSearchBar({ value, onChange, placeholder = "Search recipes by name or tags..." }: RecipeSearchBarProps) {
  return (
    <div className="mb-4 sm:mb-6">
      <div className="relative hover:shadow-md rounded-lg">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg bg-white px-4 py-3 pl-10 text-base text-gray-900 placeholder-gray-500 focus:shadow-md focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
        />
        <HiMagnifyingGlass className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <AiOutlineClose className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

