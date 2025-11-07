#!/usr/bin/env node
/**
 * Script to list all meals in the database and identify variations
 * (e.g., burger with beef vs burger with chicken)
 *
 * Usage:
 *   npx tsx scripts/list-meal-variations.ts
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/supabase";

type Ingredient = {
  name: string;
  amount: string;
  notes?: string;
};

type Recipe = {
  slug: string;
  name: string;
  ingredients: string; // JSON string
  tags: string[];
};

type MealVariation = {
  baseName: string;
  recipes: Array<{
    slug: string;
    name: string;
    protein?: string;
    keyIngredients: string[];
  }>;
};

async function loadEnvValue(key: string): Promise<string | undefined> {
  if (process.env[key]) {
    return process.env[key];
  }

  const envLocalPath = path.resolve(".env.local");

  try {
    const content = await fs.readFile(envLocalPath, "utf-8");
    const lines = content.split("\n").map((line) => line.replace(/\r$/, ""));

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const [envKey, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim();
      if (!value) continue;

      if (envKey === key) {
        process.env[key] = value;
        return value;
      }
    }
  } catch {
    // silently ignore; we'll throw below if still missing
  }

  return undefined;
}

async function getSupabaseAdmin() {
  const supabaseUrl = await loadEnvValue("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = await loadEnvValue("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase admin client not configured. Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function parseIngredients(ingredientsJson: string): Ingredient[] {
  try {
    return JSON.parse(ingredientsJson);
  } catch {
    return [];
  }
}

function extractProtein(ingredients: Ingredient[]): string | undefined {
  const proteinKeywords = [
    "beef",
    "chicken",
    "pork",
    "turkey",
    "lamb",
    "fish",
    "salmon",
    "tuna",
    "shrimp",
    "crab",
    "tofu",
    "tempeh",
    "seitan",
    "vegan",
    "vegetarian",
  ];

  for (const ingredient of ingredients) {
    const nameLower = ingredient.name.toLowerCase();
    for (const keyword of proteinKeywords) {
      if (nameLower.includes(keyword)) {
        return keyword;
      }
    }
  }

  return undefined;
}

function normalizeMealName(name: string): string {
  // Remove common protein variations and descriptors
  let normalized = name.toLowerCase();

  // Remove protein types
  normalized = normalized
    .replace(
      /\b(beef|chicken|pork|turkey|lamb|fish|salmon|tuna|shrimp|crab|tofu|tempeh|seitan)\b/gi,
      "",
    )
    .trim();

  // Remove common descriptors
  normalized = normalized
    .replace(/\b(classic|traditional|homemade|easy|quick|simple|best|ultimate|perfect)\b/gi, "")
    .trim();

  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();

  // Remove leading/trailing "with" or "and"
  normalized = normalized
    .replace(/^(with|and)\s+/i, "")
    .replace(/\s+(with|and)$/i, "")
    .trim();

  return normalized || name.toLowerCase(); // Fallback to original if empty
}

function getKeyIngredients(ingredients: Ingredient[], limit: number = 3): string[] {
  // Get main ingredients (excluding common pantry items)
  const excludeWords = [
    "salt",
    "pepper",
    "oil",
    "butter",
    "water",
    "flour",
    "sugar",
    "garlic",
    "onion",
    "salt and pepper",
  ];

  return ingredients
    .map((ing) => ing.name.toLowerCase())
    .filter((name) => !excludeWords.some((exclude) => name.includes(exclude)))
    .slice(0, limit);
}

async function getAllRecipes(
  supabaseAdmin: Awaited<ReturnType<typeof getSupabaseAdmin>>,
): Promise<Recipe[]> {
  const { data: recipes, error } = await supabaseAdmin
    .from("recipes")
    .select("slug, name, ingredients, tags")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Error fetching recipes: ${error.message}`);
  }

  return recipes || [];
}

function groupMealVariations(recipes: Recipe[]): MealVariation[] {
  const variationsMap = new Map<string, MealVariation>();

  for (const recipe of recipes) {
    const ingredients = parseIngredients(recipe.ingredients);
    const protein = extractProtein(ingredients);
    const baseName = normalizeMealName(recipe.name);
    const keyIngredients = getKeyIngredients(ingredients);

    if (!variationsMap.has(baseName)) {
      variationsMap.set(baseName, {
        baseName,
        recipes: [],
      });
    }

    const variation = variationsMap.get(baseName)!;
    variation.recipes.push({
      slug: recipe.slug,
      name: recipe.name,
      protein,
      keyIngredients,
    });
  }

  // Filter to only show meals with multiple variations
  return Array.from(variationsMap.values())
    .filter((v) => v.recipes.length > 1)
    .sort((a, b) => b.recipes.length - a.recipes.length);
}

function printAllMeals(recipes: Recipe[]): void {
  console.log("\n=== All Meals in Database ===\n");
  console.log(`Total recipes: ${recipes.length}\n`);

  const meals = recipes.map((r) => r.name).sort();
  for (const meal of meals) {
    console.log(`  - ${meal}`);
  }
  console.log();
}

function printMealVariations(variations: MealVariation[]): void {
  console.log("\n=== Meal Variations ===\n");

  if (variations.length === 0) {
    console.log("No meal variations found (meals with multiple recipes).\n");
    return;
  }

  console.log(`Found ${variations.length} meals with variations:\n`);

  for (const variation of variations) {
    console.log(`📋 ${variation.baseName.toUpperCase()}`);
    console.log(`   ${variation.recipes.length} variation(s):\n`);

    for (const recipe of variation.recipes) {
      console.log(`   • ${recipe.name}`);
      if (recipe.protein) {
        console.log(`     Protein: ${recipe.protein}`);
      }
      if (recipe.keyIngredients.length > 0) {
        console.log(`     Key ingredients: ${recipe.keyIngredients.join(", ")}`);
      }
      console.log(`     Slug: ${recipe.slug}`);
      console.log();
    }
    console.log();
  }
}

function printStatistics(recipes: Recipe[], variations: MealVariation[]): void {
  console.log("\n=== Statistics ===\n");
  console.log(`Total recipes: ${recipes.length}`);
  console.log(`Unique base meals: ${new Set(recipes.map((r) => normalizeMealName(r.name))).size}`);
  console.log(`Meals with variations: ${variations.length}`);
  console.log(
    `Total recipes in variations: ${variations.reduce((sum, v) => sum + v.recipes.length, 0)}`,
  );

  if (variations.length > 0) {
    const maxVariations = Math.max(...variations.map((v) => v.recipes.length));
    const mealWithMostVariations = variations.find((v) => v.recipes.length === maxVariations);
    console.log(
      `\nMeal with most variations: "${mealWithMostVariations!.baseName}" (${maxVariations} variations)`,
    );
  }
  console.log();
}

async function main() {
  const args = process.argv.slice(2);
  const variationsOnly = args.includes("--variations-only");
  const statsOnly = args.includes("--stats-only");

  try {
    const supabaseAdmin = await getSupabaseAdmin();
    const allRecipes = await getAllRecipes(supabaseAdmin);
    const variations = groupMealVariations(allRecipes);

    if (statsOnly) {
      printStatistics(allRecipes, variations);
    } else if (variationsOnly) {
      printMealVariations(variations);
    } else {
      printAllMeals(allRecipes);
      printMealVariations(variations);
      printStatistics(allRecipes, variations);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

