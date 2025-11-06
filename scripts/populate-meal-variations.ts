#!/usr/bin/env node
/**
 * Script to populate variation_of field for existing recipes using LLM analysis
 * 
 * This script:
 * 1. Uses the LLM to detect meal variations
 * 2. Updates the database with variation_of values for all recipes that are variations
 * 
 * Usage:
 *   npx tsx scripts/populate-meal-variations.ts
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/supabase";
import { callGemini, ensureText, TEXT_MODEL } from "../src/lib/gemini";

type Recipe = {
  slug: string;
  name: string;
};

type MealVariationGroup = {
  baseMeal: string;
  variations: Array<{
    name: string;
    slug: string;
    variationType: string;
    variationDetail: string;
  }>;
  description?: string;
};

type LLMResponse = {
  mealVariations: MealVariationGroup[];
  summary: {
    totalMeals: number;
    mealsWithVariations: number;
    totalVariations: number;
  };
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

async function getAllRecipes(
  supabaseAdmin: Awaited<ReturnType<typeof getSupabaseAdmin>>,
): Promise<Recipe[]> {
  const { data: recipes, error } = await supabaseAdmin
    .from("recipes")
    .select("slug, name")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Error fetching recipes: ${error.message}`);
  }

  return recipes || [];
}

function buildVariationAnalysisPrompt(recipes: Recipe[]): string {
  const mealList = recipes
    .map((r, i) => `${i + 1}. ${r.name} (slug: ${r.slug})`)
    .join("\n");

  return `You are analyzing a recipe database to identify meal variations. A meal variation is when the same base meal exists with different ingredients, proteins, or preparation styles.

For example:
- "Chicken Fried Rice", "Pork Fried Rice", "Shrimp Fried Rice" are variations of "Fried Rice"
- "Beef Burrito Bowls" and "Chicken Burrito Bowls" are variations of "Burrito Bowls"
- "Classic Beef Tacos" and "Buffalo Chicken Tacos" are variations of "Tacos"

Here are all the meals from the database (with their slugs):

${mealList}

Analyze these meal names and identify:
1. Base meals that have multiple variations (same dish with different proteins, ingredients, or styles)
2. For each variation group, identify:
   - The base meal name (normalized, e.g., "Fried Rice", "Tacos", "Burrito Bowls")
   - Each variation with its full name, the exact slug provided, and what makes it different (protein type, style, ingredient, etc.)
   - The type of variation (protein, style, ingredient, cuisine, etc.)

Only include meals that have at least 2 variations. Ignore meals that appear only once.

IMPORTANT: Use the exact slug provided for each meal name. Do not generate or infer slugs.

Return the results in a structured JSON format.`;
}

const variationAnalysisSchema = {
  type: "object",
  properties: {
    mealVariations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          baseMeal: {
            type: "string",
            description: "The normalized base meal name (e.g., 'Fried Rice', 'Tacos')",
          },
          variations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "The full recipe name",
                },
                slug: {
                  type: "string",
                  description: "The recipe slug (you'll need to infer this from the name)",
                },
                variationType: {
                  type: "string",
                  enum: ["protein", "style", "ingredient", "cuisine", "preparation", "other"],
                  description: "The type of variation",
                },
                variationDetail: {
                  type: "string",
                  description: "What makes this variation different (e.g., 'beef', 'chicken', 'vegetarian', 'spicy')",
                },
              },
              required: ["name", "slug", "variationType", "variationDetail"],
            },
          },
          description: {
            type: "string",
            description: "Optional description of what this meal group represents",
          },
        },
        required: ["baseMeal", "variations"],
      },
    },
    summary: {
      type: "object",
      properties: {
        totalMeals: {
          type: "number",
          description: "Total number of unique meals analyzed",
        },
        mealsWithVariations: {
          type: "number",
          description: "Number of base meals that have variations",
        },
        totalVariations: {
          type: "number",
          description: "Total number of recipe variations found",
        },
      },
      required: ["totalMeals", "mealsWithVariations", "totalVariations"],
    },
  },
  required: ["mealVariations", "summary"],
} as const;

async function findVariationsWithLLM(recipes: Recipe[]): Promise<LLMResponse> {
  const prompt = buildVariationAnalysisPrompt(recipes);

  // Create a map of name to slug for lookup (as backup)
  const nameToSlug = new Map(recipes.map((r) => [r.name, r.slug]));

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: variationAnalysisSchema,
      temperature: 0.3,
    },
  };

  console.log(`[LLM] Calling Gemini API to analyze ${recipes.length} meals...`);
  const llmStartTime = Date.now();
  const response = await callGemini(TEXT_MODEL, requestBody);
  const llmDuration = Date.now() - llmStartTime;
  console.log(`[LLM] Gemini API call completed in ${llmDuration}ms`);

  const jsonText = ensureText(response, "Meal variation analysis");
  const parsed = JSON.parse(jsonText) as LLMResponse;

  // Fix slugs in the response by looking them up from the actual recipes (backup)
  for (const group of parsed.mealVariations) {
    for (const variation of group.variations) {
      const actualSlug = nameToSlug.get(variation.name);
      if (actualSlug && variation.slug !== actualSlug) {
        console.warn(
          `[Warning] Slug mismatch for "${variation.name}": LLM returned "${variation.slug}", using actual "${actualSlug}"`,
        );
        variation.slug = actualSlug;
      }
    }
  }

  return parsed;
}

async function updateRecipeVariations(
  supabaseAdmin: Awaited<ReturnType<typeof getSupabaseAdmin>>,
  variations: LLMResponse,
): Promise<void> {
  console.log("\nUpdating database with variation_of values...\n");

  let updatedCount = 0;
  let errorCount = 0;

  // Create a map of slug to baseMeal for quick lookup
  const slugToBaseMeal = new Map<string, string>();

  for (const group of variations.mealVariations) {
    for (const variation of group.variations) {
      slugToBaseMeal.set(variation.slug, group.baseMeal);
    }
  }

  // Update each recipe
  for (const [slug, baseMeal] of slugToBaseMeal.entries()) {
    try {
      const { error } = await supabaseAdmin
        .from("recipes")
        .update({ variation_of: baseMeal })
        .eq("slug", slug);

      if (error) {
        console.error(`Failed to update ${slug}: ${error.message}`);
        errorCount++;
      } else {
        console.log(`✓ Updated ${slug} → variation_of: "${baseMeal}"`);
        updatedCount++;
      }
    } catch (error) {
      console.error(`Error updating ${slug}:`, error);
      errorCount++;
    }
  }

  console.log(`\n✅ Successfully updated ${updatedCount} recipes`);
  if (errorCount > 0) {
    console.log(`⚠️  ${errorCount} recipes failed to update`);
  }
}

async function main() {
  try {
    // Load Gemini API key from .env.local
    const geminiKey = await loadEnvValue("GEMINI_API_KEY") || await loadEnvValue("GOOGLE_API_KEY");
    if (!geminiKey) {
      throw new Error(
        "GEMINI_API_KEY or GOOGLE_API_KEY not found in environment or .env.local",
      );
    }
    // Set it in process.env so gemini.ts can access it
    process.env.GEMINI_API_KEY = geminiKey;

    // Fetch all recipes
    const supabaseAdmin = await getSupabaseAdmin();
    console.log("Fetching all recipes from database...");
    const allRecipes = await getAllRecipes(supabaseAdmin);
    console.log(`Found ${allRecipes.length} recipes\n`);

    // Analyze with LLM
    const results = await findVariationsWithLLM(allRecipes);

    console.log(`\nFound ${results.summary.mealsWithVariations} meal groups with ${results.summary.totalVariations} total variations`);

    // Update database
    await updateRecipeVariations(supabaseAdmin, results);

    console.log("\n✅ Population complete!");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:", error.stack);
    }
    process.exit(1);
  }
}

main();

