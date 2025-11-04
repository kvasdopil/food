"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSessionToken } from "@/hooks/useSessionToken";
import { useRecipeGeneration } from "@/hooks/useRecipeGeneration";
import { useRecipeImage } from "@/hooks/useRecipeImage";
import { RecipeInputForm } from "@/components/recipe-input-form";
import { RecipePreviewCard } from "@/components/recipe-preview-card";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="h-full max-h-[80vh] w-full overflow-y-auto rounded-none border-0 p-4 sm:h-auto sm:max-w-lg sm:rounded-lg sm:border sm:p-6">
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
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={handleAddRecipe}
                  disabled={isAdding}
                  className="flex flex-1 items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  {isAdding ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    "Add recipe"
                  )}
                </Button>
                <Button
                  onClick={handleCancel}
                  disabled={isAdding}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
