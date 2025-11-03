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
            ? ingredient.amount
                .split("(")
                .slice(1)
                .join("(")
                .replace(/\)$/, "")
                .trim()
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
  return (
    lower.includes("all checks passed") || lower.includes("no changes needed")
  );
}

