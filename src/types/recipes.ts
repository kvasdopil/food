/**
 * Shared recipe type definitions
 */

export type Ingredient = {
  name: string;
  amount: string;
  notes?: string;
};

export type Instruction = {
  step?: number;
  action: string;
};

export type GeneratedRecipe = {
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

export type RecipeListItem = {
  slug: string;
  name: string;
  description: string | null;
  tags: string[];
  image_url: string | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
};

