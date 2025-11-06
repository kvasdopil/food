#!/usr/bin/env node
/**
 * Script to find meal variations using Google LLM (Gemini)
 * Fetches all meal names from database, then uses LLM to identify variations
 *
 * Usage:
 *   npx tsx scripts/find-meal-variations-llm.ts
 *   npx tsx scripts/find-meal-variations-llm.ts --json
 */

import {
  getSupabaseAdmin,
  getAllRecipes,
  findVariationsWithLLM,
  loadEnvValue,
  type LLMResponse,
  type Recipe,
} from "./meal-variation-utils";

function printResults(results: LLMResponse, allRecipes: Recipe[]): void {
  console.log("\n" + "=".repeat(80));
  console.log("MEAL VARIATIONS ANALYSIS");
  console.log("=".repeat(80) + "\n");

  console.log(`Total recipes in database: ${allRecipes.length}`);
  console.log(`Meals with variations: ${results.summary.mealsWithVariations}`);
  console.log(`Total variations found: ${results.summary.totalVariations}\n`);

  if (results.mealVariations.length === 0) {
    console.log("No meal variations found.\n");
    return;
  }

  // Sort by number of variations (descending)
  const sortedVariations = [...results.mealVariations].sort(
    (a, b) => b.variations.length - a.variations.length,
  );

  for (const group of sortedVariations) {
    console.log(`\n${"─".repeat(80)}`);
    console.log(`📋 ${group.baseMeal.toUpperCase()}`);
    if (group.description) {
      console.log(`   ${group.description}`);
    }
    console.log(`   ${group.variations.length} variation(s):\n`);

    for (const variation of group.variations) {
      console.log(`   • ${variation.name}`);
      console.log(`     Variation: ${variation.variationType} - ${variation.variationDetail}`);
      console.log(`     Slug: ${variation.slug}`);
    }
  }

  console.log("\n" + "=".repeat(80) + "\n");
}

function printJSON(results: LLMResponse): void {
  console.log(JSON.stringify(results, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");

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

    // Output results
    if (jsonOutput) {
      printJSON(results);
    } else {
      printResults(results, allRecipes);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:", error.stack);
    }
    process.exit(1);
  }
}

main();

