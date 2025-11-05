"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSessionToken } from "@/hooks/useSessionToken";
import { useRecipeGeneration } from "@/hooks/useRecipeGeneration";
import { RecipeInputForm } from "@/components/recipe-input-form";
import { RecipePreviewCard } from "@/components/recipe-preview-card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
    isParsing,
    isGenerating,
    isAdding,
    error,
    generateRecipe,
    addRecipe,
    reset,
    setError,
  } = useRecipeGeneration();

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

  // Scroll to recipe card when it's generated
  useEffect(() => {
    if (generatedRecipe) {
      // Scroll to recipe card
      setTimeout(() => {
        const cardElement = document.getElementById("generated-recipe-card");
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 100);
      // Image generation is now handled automatically in useRecipeGeneration hook
    }
  }, [generatedRecipe]);

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

  // Show card as soon as parsing starts (supports streaming updates)
  const hasRecipeData = isParsing || isGenerating || (generatedRecipe && generatedRecipe.title);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="top-0 right-0 bottom-0 left-0 flex h-full max-h-[100vh] w-full max-w-full translate-x-0 translate-y-0 flex-col justify-center overflow-y-auto rounded-none border-0 p-4 sm:top-[50%] sm:right-auto sm:bottom-auto sm:left-[50%] sm:h-auto sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:justify-start sm:rounded-lg sm:border sm:p-6">
        <DialogTitle className="sr-only">
          {hasRecipeData ? "Recipe Preview" : "Create Recipe"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {hasRecipeData ? "Recipe preview and options" : "Create a new recipe by describing it"}
        </DialogDescription>
        <div className="space-y-4">
          {hasRecipeData && generatedRecipe && (
            <RecipePreviewCard recipe={generatedRecipe} isStreaming={isParsing || isGenerating} />
          )}

          {!hasRecipeData && (
            <RecipeInputForm
              value={userInput}
              onChange={setUserInput}
              onSubmit={handleSend}
              isLoading={isParsing || isGenerating}
              isDisabled={!userInput.trim() || isParsing || isGenerating}
              error={error}
              requiresAuth={!session}
              authLoading={authLoading}
            />
          )}

          {hasRecipeData && (
            <>
              {error && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={handleAddRecipe}
                  disabled={isAdding || isParsing || isGenerating}
                  className="flex flex-1 items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  {isAdding ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Adding...</span>
                    </>
                  ) : isParsing ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Parsing...</span>
                    </>
                  ) : isGenerating ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    "Add recipe"
                  )}
                </Button>
                <Button
                  onClick={handleCancel}
                  disabled={isAdding || isParsing || isGenerating}
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
