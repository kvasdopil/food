"use client";

import { useRef, useEffect } from "react";
import { HiSparkles } from "react-icons/hi2";

type RecipeInputFormProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isDisabled: boolean;
  error: string | null;
  requiresAuth: boolean;
  authLoading: boolean;
};

/**
 * RecipeInputForm component for the recipe generation input form
 */
export function RecipeInputForm({
  value,
  onChange,
  onSubmit,
  isLoading,
  isDisabled,
  error,
  requiresAuth,
  authLoading,
}: RecipeInputFormProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <>
      <div>
        <label htmlFor="recipe-input" className="mb-2 block text-sm font-medium text-gray-700">
          Describe the recipe you want to create
        </label>
        <textarea
          id="recipe-input"
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., A spicy Thai curry with chicken and vegetables, serves 4, ready in 45 minutes..."
          className="min-h-[120px] w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          disabled={isLoading}
        />
      </div>

      {requiresAuth && !authLoading && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
          <p className="text-sm text-yellow-800">
            You need to be logged in to generate recipes. Please sign in first.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="flex justify-center">
        <button
          onClick={onSubmit}
          disabled={isDisabled || isLoading || requiresAuth || authLoading}
          className="flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-300 disabled:hover:bg-gray-300"
        >
          {isLoading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <HiSparkles className="h-4 w-4" />
              <span>Create recipe</span>
            </>
          )}
        </button>
      </div>
    </>
  );
}

