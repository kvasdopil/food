"use client";

import { useEffect, useState } from "react";
import { AiOutlineClose } from "react-icons/ai";
import { useAuth } from "@/hooks/useAuth";
import { useSessionToken } from "@/hooks/useSessionToken";
import { useRecipeGeneration } from "@/hooks/useRecipeGeneration";
import { useRecipeImage } from "@/hooks/useRecipeImage";
import { useModal } from "@/hooks/useModal";
import { RecipeInputForm } from "@/components/recipe-input-form";
import { RecipePreviewCard } from "@/components/recipe-preview-card";

interface AddRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddRecipeModal({ isOpen, onClose }: AddRecipeModalProps) {
  const { session, loading: authLoading } = useAuth();
  const { fetchToken } = useSessionToken();
  const [userInput, setUserInput] = useState("");

  const {
    generatedRecipe,
    isGenerating,
    isAdding,
    error,
    generateRecipe,
    addRecipe,
    updateRecipeImage,
    reset,
    setError,
  } = useRecipeGeneration();

  const { generateImage } = useRecipeImage();

  const modalRef = useModal(isOpen, onClose, {
    closeOnEscape: true,
    closeOnOutsideClick: true,
    preventBodyScroll: true,
    autoFocus: false, // We'll handle focus in RecipeInputForm
  });

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Use a cleanup function to reset state when modal closes
      return () => {
        setUserInput("");
        reset();
      };
    }
  }, [isOpen, reset]);

  // Scroll to recipe card when it's generated and generate preview image
  useEffect(() => {
    if (generatedRecipe) {
      // Scroll to recipe card
      setTimeout(() => {
        const cardElement = document.getElementById("generated-recipe-card");
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 100);

      // Generate preview image if imagePrompt is available
      const generateImageIfNeeded = async () => {
        if (generatedRecipe.imagePrompt?.base && !generatedRecipe.image_url) {
          const accessToken = await fetchToken();
          if (accessToken) {
            const imageUrl = await generateImage(generatedRecipe.imagePrompt.base, accessToken);
            if (imageUrl) {
              updateRecipeImage(imageUrl);
            }
          }
        }
      };

      generateImageIfNeeded();
    }
  }, [generatedRecipe, fetchToken, generateImage, updateRecipeImage]);

  const handleSend = async () => {
    if (!userInput.trim() || isGenerating || !session) {
      return;
    }

    const accessToken = await fetchToken();
    if (!accessToken) {
      setError("Unable to get session token. Please log in again.");
      return;
    }

    // Clear input before generation
    const input = userInput.trim();
    setUserInput("");

    await generateRecipe(input, accessToken);
    // Image generation is handled in useEffect when generatedRecipe updates
  };

  const handleAddRecipe = async () => {
    if (!generatedRecipe || !session || isAdding) {
      return;
    }

    const accessToken = await fetchToken();
    if (!accessToken) {
      setError("Unable to get session token. Please log in again.");
      return;
    }

    await addRecipe(generatedRecipe, accessToken, onClose);
  };

  const handleCancel = () => {
    reset();
    setUserInput("");
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
        {/* Close button */}
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
            {generatedRecipe && <RecipePreviewCard recipe={generatedRecipe} />}

            {!generatedRecipe && (
              <RecipeInputForm
                value={userInput}
                onChange={setUserInput}
                onSubmit={handleSend}
                isLoading={isGenerating}
                isDisabled={!userInput.trim()}
                error={error}
                requiresAuth={!session}
                authLoading={authLoading}
              />
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
                    disabled={isAdding}
                    className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-400 disabled:hover:bg-gray-400"
                  >
                    {isAdding ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Adding...</span>
                      </>
                    ) : (
                      "Add recipe"
                    )}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isAdding}
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
