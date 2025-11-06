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

import {
  getSupabaseAdmin,
  getAllRecipes,
  findVariationsWithLLM,
  loadEnvValue,
  type LLMResponse,
} from "./meal-variation-utils";

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

