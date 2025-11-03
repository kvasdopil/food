"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AiOutlineClose } from "react-icons/ai";
import { HiSparkles } from "react-icons/hi2";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { RecipeFeedCard } from "@/components/recipe-feed-card";

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Ingredient = {
  name: string;
  amount: string;
  notes?: string;
};

type Instruction = {
  step?: number;
  action: string;
};

type GeneratedRecipe = {
  slug: string;
  name: string;
  description: string | null;
  tags: string[];
  image_url: string | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  title: string;
  summary: string | null;
  ingredients: Ingredient[];
  instructions: Instruction[];
  servings: number | null;
  imagePrompt?: {
    base: string;
  };
};

export function AddRecipeModal({ isOpen, onClose }: AddRecipeModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingRecipe, setIsAddingRecipe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null);
  const { session, loading: authLoading } = useAuth();

  // Close modal on Escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setUserInput("");
      setError(null);
      setIsLoading(false);
      setIsAddingRecipe(false);
      setGeneratedRecipe(null);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!userInput.trim() || isLoading) {
      return;
    }

    // Check if user is logged in
    if (!session) {
      setError("Please log in to generate recipes");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get the Supabase session token
      if (!supabase) {
        throw new Error("Supabase client not configured");
      }

      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !currentSession?.access_token) {
        throw new Error("Unable to get session token. Please log in again.");
      }

      const response = await fetch("/api/recipes/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          userInput: userInput.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate recipe");
      }

      const data = await response.json();
      const recipe = data.recipe;

      // Store the generated recipe and keep modal open
      const recipeData: GeneratedRecipe = {
        slug: recipe.slug,
        name: recipe.name,
        description: recipe.description,
        tags: recipe.tags || [],
        image_url: recipe.image_url,
        prepTimeMinutes: recipe.prepTimeMinutes,
        cookTimeMinutes: recipe.cookTimeMinutes,
        title: recipe.title,
        summary: recipe.summary,
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        servings: recipe.servings,
        imagePrompt: recipe.imagePrompt,
      };
      setGeneratedRecipe(recipeData);

      // Clear input but keep modal open
      setUserInput("");
      setIsLoading(false);

      // Scroll to the generated recipe card
      setTimeout(() => {
        const cardElement = document.getElementById("generated-recipe-card");
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 100);

      // Immediately generate preview image if imagePrompt is available
      if (recipe.imagePrompt?.base && currentSession?.access_token) {
        generatePreviewImage(recipe.imagePrompt.base, currentSession.access_token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate recipe");
      setIsLoading(false);
    }
  };

  const generatePreviewImage = async (imagePrompt: string, accessToken: string) => {
    setError(null);

    try {
      const response = await fetch("/api/images/generate-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          description: imagePrompt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate preview image");
      }

      const data = await response.json();

      // Update the recipe with the generated image URL
      setGeneratedRecipe((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          image_url: data.url,
        };
      });
    } catch (err) {
      console.error("Failed to generate preview image:", err);
      // Don't show error to user for image generation failure - it's not critical
      setError(null); // Clear any previous errors
    }
  };

  const handleAddRecipe = async () => {
    if (!generatedRecipe || !session || isAddingRecipe) {
      return;
    }

    setIsAddingRecipe(true);
    setError(null);

    try {
      if (!supabase) {
        throw new Error("Supabase client not configured");
      }

      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !currentSession?.access_token) {
        throw new Error("Unable to get session token. Please log in again.");
      }

      // Prepare recipe payload for POST /api/recipes
      const recipePayload = {
        slug: generatedRecipe.slug,
        title: generatedRecipe.title,
        summary: generatedRecipe.summary,
        ingredients: generatedRecipe.ingredients,
        instructions: generatedRecipe.instructions,
        tags: generatedRecipe.tags,
        imageUrl: generatedRecipe.image_url,
        prepTimeMinutes: generatedRecipe.prepTimeMinutes,
        cookTimeMinutes: generatedRecipe.cookTimeMinutes,
      };

      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify(recipePayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add recipe");
      }

      const data = await response.json();
      const createdSlug = data.recipe?.slug || generatedRecipe.slug;

      // Navigate to the newly created recipe page
      router.push(`/recipes/${createdSlug}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add recipe");
      setIsAddingRecipe(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative z-10 h-full w-full rounded-xl bg-white sm:h-auto sm:w-auto sm:max-w-lg sm:shadow-xl"
      >
        {/* Close button at corner */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-100 hover:text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          aria-label="Close modal"
        >
          <AiOutlineClose className="h-5 w-5 text-gray-600" />
        </button>

        {/* Content */}
        <div className="max-h-[80vh] overflow-y-auto p-4 sm:p-6">
          <div className="space-y-4">
            {generatedRecipe && (
              <div id="generated-recipe-card" className="pointer-events-none relative">
                <div className="pointer-events-none">
                  <RecipeFeedCard
                    slug={generatedRecipe.slug}
                    name={generatedRecipe.name}
                    description={generatedRecipe.description}
                    tags={generatedRecipe.tags}
                    imageUrl={generatedRecipe.image_url}
                    prepTimeMinutes={generatedRecipe.prepTimeMinutes}
                    cookTimeMinutes={generatedRecipe.cookTimeMinutes}
                  />
                </div>
              </div>
            )}

            {!generatedRecipe && (
              <>
                <div>
                  <label
                    htmlFor="recipe-input"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Describe the recipe you want to create
                  </label>
                  <textarea
                    id="recipe-input"
                    ref={textareaRef}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g., A spicy Thai curry with chicken and vegetables, serves 4, ready in 45 minutes..."
                    className="min-h-[120px] w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    disabled={isLoading}
                  />
                </div>

                {!authLoading && !session && (
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
                    onClick={handleSend}
                    disabled={!userInput.trim() || isLoading || !session || authLoading}
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
            )}

            {generatedRecipe && (
              <>
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleAddRecipe}
                    disabled={isAddingRecipe}
                    className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-400 disabled:hover:bg-gray-400"
                  >
                    {isAddingRecipe ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Adding...</span>
                      </>
                    ) : (
                      "Add recipe"
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setGeneratedRecipe(null);
                      setUserInput("");
                      setError(null);
                    }}
                    disabled={isAddingRecipe}
                    className="flex-1 cursor-pointer rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
