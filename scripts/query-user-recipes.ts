#!/usr/bin/env node
/**
 * Query script to list recipes by user and user activity statistics
 *
 * Usage:
 *   npx tsx scripts/query-user-recipes.ts
 *   npx tsx scripts/query-user-recipes.ts --user-email user@example.com
 *   npx tsx scripts/query-user-recipes.ts --stats-only
 */

import { getSupabaseAdmin } from "./script-utils";

type RecipeSummary = {
  slug: string;
  name: string;
  created_at: string;
  author_name: string | null;
  author_email: string | null;
};

type UserRecipeStats = {
  email: string;
  name: string;
  recipeCount: number;
  recipes: RecipeSummary[];
};

async function getAllUserRecipes(
  supabaseAdmin: Awaited<ReturnType<typeof getSupabaseAdmin>>,
): Promise<UserRecipeStats[]> {
  // Get all recipes with authors
  const { data: recipes, error } = await supabaseAdmin
    .from("recipes")
    .select("slug, name, author_name, author_email, created_at")
    .not("author_email", "is", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Error fetching recipes: ${error.message}`);
  }

  if (!recipes || recipes.length === 0) {
    return [];
  }

  // Group by user email
  const recipesByUser = new Map<string, UserRecipeStats>();

  for (const recipe of recipes) {
    const email = recipe.author_email!.toLowerCase();
    const displayName = recipe.author_name || email.split("@")[0];

    if (!recipesByUser.has(email)) {
      recipesByUser.set(email, {
        email,
        name: displayName,
        recipeCount: 0,
        recipes: [],
      });
    }

    const userStats = recipesByUser.get(email)!;
    userStats.recipes.push({
      slug: recipe.slug,
      name: recipe.name,
      created_at: recipe.created_at,
      author_name: recipe.author_name,
      author_email: recipe.author_email,
    });
    userStats.recipeCount = userStats.recipes.length;
  }

  return Array.from(recipesByUser.values()).sort((a, b) => b.recipeCount - a.recipeCount);
}

function printUserRecipes(userStats: UserRecipeStats[], showDetails: boolean = true): void {
  console.log("\n=== Recipes by User ===\n");

  if (userStats.length === 0) {
    console.log("No recipes with author attribution found.");
    console.log("(Recipes created via scripts/EDIT_TOKEN don't have authors)\n");
    return;
  }

  for (const user of userStats) {
    console.log(`${user.name} (${user.email})`);
    console.log(`  Recipes created: ${user.recipeCount}`);

    if (showDetails && user.recipes.length > 0) {
      console.log("  Recipes:");
      for (const recipe of user.recipes) {
        const date = new Date(recipe.created_at).toLocaleDateString();
        console.log(`    - ${recipe.name}`);
        console.log(`      Slug: ${recipe.slug}`);
        console.log(`      Created: ${date}`);
      }
    }
    console.log();
  }
}

function printStatistics(userStats: UserRecipeStats[]): void {
  console.log("\n=== Statistics ===\n");

  if (userStats.length === 0) {
    console.log("No data available.\n");
    return;
  }

  const totalRecipes = userStats.reduce((sum, user) => sum + user.recipeCount, 0);
  const avgRecipes = totalRecipes / userStats.length;
  const maxRecipes = Math.max(...userStats.map((u) => u.recipeCount));
  const minRecipes = Math.min(...userStats.map((u) => u.recipeCount));

  console.log(`Total users with recipes: ${userStats.length}`);
  console.log(`Total recipes with authors: ${totalRecipes}`);
  console.log(`Average recipes per user: ${avgRecipes.toFixed(2)}`);
  console.log(`Most recipes by one user: ${maxRecipes}`);
  console.log(`Fewest recipes by one user: ${minRecipes}`);
  console.log();
}

async function filterByEmail(
  userStats: UserRecipeStats[],
  email: string,
): Promise<UserRecipeStats | null> {
  const normalizedEmail = email.toLowerCase();
  return userStats.find((u) => u.email === normalizedEmail) || null;
}

async function main() {
  const args = process.argv.slice(2);
  const userEmail = args.find((arg) => arg.startsWith("--user-email="))?.split("=")[1];
  const statsOnly = args.includes("--stats-only");

  try {
    const supabaseAdmin = await getSupabaseAdmin();
    const allUserStats = await getAllUserRecipes(supabaseAdmin);

    if (userEmail) {
      const userStats = await filterByEmail(allUserStats, userEmail);
      if (!userStats) {
        console.log(`No recipes found for user: ${userEmail}`);
        return;
      }
      printUserRecipes([userStats], true);
    } else if (statsOnly) {
      printStatistics(allUserStats);
    } else {
      printUserRecipes(allUserStats, true);
      printStatistics(allUserStats);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
