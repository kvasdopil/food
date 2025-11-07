"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSessionToken } from "@/hooks/useSessionToken";
import { useRecipeGeneration } from "@/hooks/useRecipeGeneration";
import { RecipePreviewCard } from "@/components/recipe-preview-card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { HiSparkles, HiPencilSquare } from "react-icons/hi2";
import type { RecipeData } from "@/lib/fetch-recipe-data";
import type { GeneratedRecipe } from "@/types/recipes";

interface RecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseRecipe?: RecipeData | null;
  variationOf?: string | null;
  mode?: "create" | "modify";
}

function formatRecipeForPrompt(recipe: RecipeData): string {
  const parts: string[] = [];

  parts.push(`Title: ${recipe.name}`);

  if (recipe.description) {
    parts.push(`Description: ${recipe.description}`);
  }

  // Parse and format ingredients
  let ingredients: Array<{ name: string; amount: string; notes?: string }> = [];
  try {
    ingredients = JSON.parse(recipe.ingredients);
  } catch {
    parts.push(`Ingredients: ${recipe.ingredients}`);
  }

  if (ingredients.length > 0) {
    parts.push("Ingredients:");
    ingredients.forEach((ing) => {
      const line = `- ${ing.amount} ${ing.name}`;
      if (ing.notes) {
        parts.push(`${line} (${ing.notes})`);
      } else {
        parts.push(line);
      }
    });
  }

  // Parse and format instructions
  let instructions: Array<{ step?: number; action: string }> = [];
  try {
    instructions = JSON.parse(recipe.instructions);
  } catch {
    parts.push(`Instructions: ${recipe.instructions}`);
  }

  if (instructions.length > 0) {
    parts.push("Instructions:");
    instructions.forEach((inst, idx) => {
      const stepNum = inst.step ?? idx + 1;
      parts.push(`${stepNum}. ${inst.action}`);
    });
  }

  if (recipe.tags && recipe.tags.length > 0) {
    parts.push(`Tags: ${recipe.tags.join(", ")}`);
  }

  if (recipe.prepTimeMinutes) {
    parts.push(`Prep time: ${recipe.prepTimeMinutes} minutes`);
  }

  if (recipe.cookTimeMinutes) {
    parts.push(`Cook time: ${recipe.cookTimeMinutes} minutes`);
  }

  return parts.join("\n");
}

export function RecipeModal({
  isOpen,
  onClose,
  baseRecipe: initialBaseRecipe,
  variationOf: initialVariationOf,
  mode: initialMode = "create",
}: RecipeModalProps) {
  const { session, loading: authLoading } = useAuth();
  const { fetchToken } = useSessionToken();
  const [userInput, setUserInput] = useState("");
  const [currentBaseRecipe, setCurrentBaseRecipe] = useState<RecipeData | null>(
    initialBaseRecipe || null,
  );
  const [currentVariationOf, setCurrentVariationOf] = useState<string | null>(
    initialVariationOf || null,
  );
  const [currentMode, setCurrentMode] = useState<"create" | "modify">(initialMode);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const isModifyMode = currentMode === "modify" || !!currentBaseRecipe;

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      return () => {
        setUserInput("");
        setCurrentBaseRecipe(initialBaseRecipe || null);
        setCurrentVariationOf(initialVariationOf || null);
        setCurrentMode(initialMode);
        reset();
      };
    }
  }, [isOpen, reset, initialBaseRecipe, initialVariationOf, initialMode]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current && !generatedRecipe) {
      textareaRef.current.focus();
    }
  }, [isOpen, generatedRecipe]);

  // Scroll to recipe card when it's generated
  useEffect(() => {
    if (generatedRecipe) {
      setTimeout(() => {
        const cardElement = document.getElementById("generated-recipe-card");
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 100);
    }
  }, [generatedRecipe]);

  const handleGenerate = async () => {
    if (!userInput.trim() || isGenerating || !session) {
      return;
    }

    const accessToken = await fetchToken();
    if (!accessToken) {
      setError("Unable to get session token. Please log in again.");
      return;
    }

    let input = userInput.trim();

    // If modifying/creating variant, prepend base recipe info
    if (currentBaseRecipe) {
      const baseRecipeText = formatRecipeForPrompt(currentBaseRecipe);
      input = `I want to create a new recipe based on this one:\n\n${baseRecipeText}\n\nHere's what I want to change: ${input}`;
    }

    await generateRecipe(input, accessToken, currentVariationOf, !!currentBaseRecipe);
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

    await addRecipe(
      generatedRecipe,
      accessToken,
      onClose,
      currentVariationOf,
      currentBaseRecipe?.slug,
    );
  };

  const handleChangeSomething = () => {
    if (!generatedRecipe) return;

    // Convert GeneratedRecipe to RecipeData format
    const newBaseRecipe: RecipeData = {
      slug: generatedRecipe.slug,
      name: generatedRecipe.name || generatedRecipe.title,
      description: generatedRecipe.description || generatedRecipe.summary || "",
      ingredients: JSON.stringify(generatedRecipe.ingredients),
      instructions: JSON.stringify(generatedRecipe.instructions),
      imageUrl: generatedRecipe.image_url,
      tags: generatedRecipe.tags || [],
      prepTimeMinutes: generatedRecipe.prepTimeMinutes,
      cookTimeMinutes: generatedRecipe.cookTimeMinutes,
      variationOf: currentVariationOf,
      variants: [],
    };

    // Set the generated recipe as the new base recipe
    setCurrentBaseRecipe(newBaseRecipe);
    setCurrentMode("modify");
    setUserInput("");
    reset();

    // Focus the textarea
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  // Check if we have first data from LLM (title/name)
  const hasFirstData = generatedRecipe && (generatedRecipe.title || generatedRecipe.name);

  // Check if recipe generation is complete
  const isComplete = !isParsing && !isGenerating && hasFirstData;

  // Determine which recipe card to show
  // Show base recipe when: we have a base recipe AND no first data yet
  const showBaseRecipe = currentBaseRecipe && !hasFirstData;

  // Show creating overlay when: we're parsing/generating but don't have first data yet
  // If we have a base recipe, show overlay on base recipe. Otherwise, show on generated recipe card.
  const showCreatingOverlay = (isParsing || isGenerating) && !hasFirstData;

  // Show input when: no first data yet
  const showInput = !hasFirstData;

  // Show buttons when: we have first data
  const showButtons = hasFirstData;

  const prefillRecipe: GeneratedRecipe | null = showBaseRecipe
    ? {
        slug: currentBaseRecipe.slug,
        name: currentBaseRecipe.name,
        title: currentBaseRecipe.name,
        description: currentBaseRecipe.description || null,
        summary: currentBaseRecipe.description || null,
        tags: currentBaseRecipe.tags || [],
        ingredients: (() => {
          try {
            return JSON.parse(currentBaseRecipe.ingredients);
          } catch {
            return [];
          }
        })(),
        instructions: (() => {
          try {
            return JSON.parse(currentBaseRecipe.instructions);
          } catch {
            return [];
          }
        })(),
        image_url: currentBaseRecipe.imageUrl,
        prepTimeMinutes: currentBaseRecipe.prepTimeMinutes ?? null,
        cookTimeMinutes: currentBaseRecipe.cookTimeMinutes ?? null,
        servings: null,
      }
    : null;

  const modalTitle = isModifyMode ? "Modify recipe" : "Create recipe";
  const inputLabel = isModifyMode
    ? "What would you like to change?"
    : "What would you like to create?";
  const buttonText = "Create";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="top-0 right-0 bottom-0 left-0 flex h-full max-h-[100vh] w-full max-w-full translate-x-0 translate-y-0 flex-col justify-center overflow-y-auto rounded-none border-0 p-4 sm:top-[50%] sm:right-auto sm:bottom-auto sm:left-[50%] sm:h-auto sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:justify-start sm:rounded-lg sm:border sm:p-6">
        <DialogTitle>{modalTitle}</DialogTitle>
        <DialogDescription className="sr-only">
          {hasFirstData
            ? "Recipe preview and options"
            : isModifyMode
              ? "Modify the recipe by describing what you want to change"
              : "Create a new recipe by describing it"}
        </DialogDescription>
        <div className="space-y-4">
          {/* Show base recipe card (with creating overlay during initial parsing) */}
          {showBaseRecipe && prefillRecipe && (
            <RecipePreviewCard
              recipe={prefillRecipe}
              isStreaming={false}
              showCreatingOverlay={showCreatingOverlay}
            />
          )}

          {/* Show generated recipe card (when we have first data, or when creating from scratch during parsing) */}
          {hasFirstData && generatedRecipe && (
            <RecipePreviewCard
              recipe={generatedRecipe}
              isStreaming={isParsing || isGenerating}
              actionButton={
                showButtons ? (
                  <div className="flex gap-3">
                    <Button
                      onClick={handleAddRecipe}
                      disabled={!isComplete || isAdding}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {isAdding ? (
                        <>
                          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>Adding...</span>
                        </>
                      ) : (
                        "Add recipe"
                      )}
                    </Button>
                    <Button
                      onClick={handleChangeSomething}
                      disabled={!isComplete || isAdding}
                      variant="outline"
                      className="flex-1"
                    >
                      <HiPencilSquare className="h-4 w-4" />
                      Change something
                    </Button>
                  </div>
                ) : null
              }
            />
          )}

          {/* Show placeholder card when creating from scratch (no base recipe) and parsing but no first data yet */}
          {!currentBaseRecipe &&
            (isParsing || isGenerating) &&
            !hasFirstData &&
            generatedRecipe && (
              <RecipePreviewCard
                recipe={generatedRecipe}
                isStreaming={false}
                showCreatingOverlay={true}
              />
            )}

          {/* Input field - shown when no first data yet */}
          {showInput && (
            <div>
              <label
                htmlFor="recipe-input"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                {inputLabel}
              </label>
              <div className="relative">
                <textarea
                  id="recipe-input"
                  ref={textareaRef}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isModifyMode
                      ? "e.g., Use chicken instead of beef, add more vegetables, make it spicier..."
                      : "e.g., A spicy Thai curry with chicken and vegetables, serves 4, ready in 45 minutes..."
                  }
                  className="min-h-[120px] w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 pr-28 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-600"
                  disabled={isParsing || isGenerating}
                />
                <Button
                  onClick={handleGenerate}
                  disabled={!userInput.trim() || isParsing || isGenerating || !session}
                  className="absolute right-1.5 bottom-3 bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  {isParsing || isGenerating ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <HiSparkles className="h-4 w-4" />
                      {buttonText}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Auth warning */}
          {!session && !authLoading && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertDescription className="text-yellow-800">
                You need to be logged in to {isModifyMode ? "modify" : "create"} recipes. Please
                sign in first.
              </AlertDescription>
            </Alert>
          )}

          {/* Error message */}
          {error && (
            <Alert variant="destructive" className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
