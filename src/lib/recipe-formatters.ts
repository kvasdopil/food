/**
 * Utility functions for formatting recipe data for prompts and display
 */

import type { RecipeData } from "@/lib/fetch-recipe-data";

/**
 * Formats a recipe for use in AI prompts
 * Converts RecipeData to a readable text format for LLM processing
 */
export function formatRecipeForPrompt(recipe: RecipeData): string {
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
