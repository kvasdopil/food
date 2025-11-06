import yaml from "js-yaml";

export type Ingredient = {
  name: string;
  amount: string;
  notes?: string;
};

export type Instruction = {
  step: number;
  action: string;
};

export type RecipeData = {
  title: string;
  summary?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  ingredients: Ingredient[];
  instructions: Instruction[];
  tags?: string[];
  variationOf?: string;
};

export function recipeToYamlString(recipe: RecipeData): string {
  const payload: Record<string, unknown> = {
    title: recipe.title,
  };

  if (recipe.summary) {
    payload.summary = recipe.summary;
  }
  if (recipe.servings) {
    payload.servings = recipe.servings;
  }
  if (recipe.prepTimeMinutes) {
    payload.prepTimeMinutes = recipe.prepTimeMinutes;
  }
  if (recipe.cookTimeMinutes) {
    payload.cookTimeMinutes = recipe.cookTimeMinutes;
  }

  payload.ingredients = recipe.ingredients.map((ingredient) => {
    const entry: Record<string, string> = {
      name: ingredient.name,
      amount: ingredient.amount,
    };
    if (ingredient.notes) {
      entry.notes = ingredient.notes;
    }
    return entry;
  });

  payload.instructions = recipe.instructions.map((instruction) => ({
    step: instruction.step,
    action: instruction.action,
  }));

  if (recipe.tags?.length) {
    payload.tags = recipe.tags;
  }

  return yaml.dump(payload);
}

export function normalizeRecipe(recipe: RecipeData): RecipeData {
  return {
    ...recipe,
    ingredients: recipe.ingredients
      .map((ingredient) => ({
        ...ingredient,
        name: ingredient.name.toLowerCase().trim(),
        // Ensure amounts don't have parenthetical notes
        amount: ingredient.amount.split("(")[0].trim(),
        notes: ingredient.notes
          ? ingredient.notes.trim()
          : ingredient.amount.includes("(")
            ? ingredient.amount.split("(").slice(1).join("(").replace(/\)$/, "").trim()
            : undefined,
      }))
      .filter((ing) => ing.amount), // Remove any invalid entries
    instructions: recipe.instructions.map((instruction, index) => ({
      step: index + 1,
      action: instruction.action.trim(),
    })),
  };
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isEvaluationPassed(evaluationResult: string): boolean {
  const lower = evaluationResult.toLowerCase();
  return lower.includes("all checks passed") || lower.includes("no changes needed");
}

/**
 * Parse ingredients from JSON string format stored in database.
 * Handles both array format and fallback parsing.
 */
export function parseIngredients(raw: string): Ingredient[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          name: String(item.name ?? "").trim(),
          amount: String(item.amount ?? "").trim(),
          notes: item.notes ? String(item.notes).trim() : undefined,
        }))
        .filter((item) => item.name.length > 0);
    }
  } catch {
    // fallback - try to parse as string format
  }
  return [];
}

/**
 * Parse instructions from string format stored in database.
 * Handles numbered steps and removes leading numbers.
 */
export function parseInstructions(raw: string): Instruction[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((step, index) => {
      // Remove leading number if present (e.g., "1. Action" -> "Action")
      const action = step.replace(/^\d+\.\s*/, "").trim();
      return {
        step: index + 1,
        action,
      };
    });
}

/**
 * Build instructions string from instruction array.
 * Formats as numbered steps.
 * Accepts instructions with optional step numbers.
 */
export function buildInstructions(instructions: Array<{ step?: number; action: string }>): string {
  return instructions
    .map((entry, index) => {
      const stepNumber = entry.step ?? index + 1;
      return `${stepNumber}. ${entry.action}`;
    })
    .join("\n");
}

/**
 * Recipe variant information for UI display
 */
export type RecipeVariant = {
  slug: string;
  name: string;
};

/**
 * Query recipe variants by variation_of field.
 * Returns all recipes that share the same variation_of value, excluding the current recipe.
 */
export async function getRecipeVariants(
  variationOf: string | null,
  currentSlug: string,
): Promise<RecipeVariant[]> {
  if (!variationOf) {
    return [];
  }

  // Dynamic import to avoid SSR issues
  const { supabase } = await import("@/lib/supabaseClient");
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("recipes")
      .select("slug, name")
      .eq("variation_of", variationOf)
      .neq("slug", currentSlug)
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to fetch recipe variants:", error);
      return [];
    }

    return (data || []).map((recipe) => ({
      slug: recipe.slug,
      name: recipe.name,
    }));
  } catch (error) {
    console.error("Error fetching recipe variants:", error);
    return [];
  }
}
