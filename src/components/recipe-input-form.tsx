"use client";

import { useRef, useEffect } from "react";
import { HiSparkles } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertDescription className="text-yellow-800">
            You need to be logged in to generate recipes. Please sign in first.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-center">
        <Button
          onClick={onSubmit}
          disabled={isDisabled || isLoading || requiresAuth || authLoading}
          className="flex items-center gap-2"
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
        </Button>
      </div>
    </>
  );
}
