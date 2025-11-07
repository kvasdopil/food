#!/usr/bin/env node
/**
 * Script to find recipes created today, refine them, and update their images
 *
 * Usage:
 *   npx tsx scripts/refine-today-recipes.ts
 *   npx tsx scripts/refine-today-recipes.ts --endpoint http://localhost:3000
 *   npx tsx scripts/refine-today-recipes.ts --skip-refine  # Only update images
 *   npx tsx scripts/refine-today-recipes.ts --skip-image  # Only refine recipes
 */

import { loadEnvValue, getSupabaseAdmin } from "./script-utils";

type RefineResponse = {
  message: string;
  evaluation?: string;
  recipe?: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    tags: string[];
    image_url: string | null;
    created_at: string;
    updated_at: string;
  };
};

type GenerateImageResponse = {
  slug: string;
  path: string;
  publicUrl: string;
  hash: string;
  message: string;
};

async function getRecipesCreatedToday(
  supabaseAdmin: Awaited<ReturnType<typeof getSupabaseAdmin>>,
): Promise<Array<{ slug: string; name: string; created_at: string }>> {
  // Get start of today in UTC
  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const startOfTodayISO = startOfToday.toISOString();

  // Get start of tomorrow in UTC
  const startOfTomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const startOfTomorrowISO = startOfTomorrow.toISOString();

  console.log(`Querying recipes created between ${startOfTodayISO} and ${startOfTomorrowISO}`);

  const { data: recipes, error } = await supabaseAdmin
    .from("recipes")
    .select("slug, name, created_at")
    .gte("created_at", startOfTodayISO)
    .lt("created_at", startOfTomorrowISO)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Error fetching recipes: ${error.message}`);
  }

  return recipes || [];
}

async function refineRecipe(
  slug: string,
  endpoint: string,
  token: string,
): Promise<RefineResponse> {
  const url = `${endpoint}/api/recipes/${encodeURIComponent(slug)}/refine`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Refine API failed (${response.status} ${response.statusText}): ${errorText}`);
  }

  return (await response.json()) as RefineResponse;
}

async function generateImage(
  slug: string,
  endpoint: string,
  token: string,
  fireflyKey?: string,
): Promise<GenerateImageResponse> {
  const url = `${endpoint}/api/recipes/${encodeURIComponent(slug)}/generate-image`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  if (fireflyKey) {
    headers["x-firefly-key"] = fireflyKey;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Image generation API failed (${response.status} ${response.statusText}): ${errorText}`,
    );
  }

  return (await response.json()) as GenerateImageResponse;
}

function printUsage() {
  const usageMessage = `
Usage: ts-node scripts/refine-today-recipes.ts [options]

This script:
  1. Queries the database directly using Supabase admin client to find recipes created today
  2. For each recipe, refines it using the /api/recipes/[slug]/refine endpoint
  3. Updates the image using the /api/recipes/[slug]/generate-image endpoint

Options:
  --endpoint <url>        API endpoint URL (defaults to http://localhost:3000 or RECIPE_API_URL env var)
  --token <token>         EDIT_TOKEN for API authentication (defaults to EDIT_TOKEN env var or .env.local)
  --firefly-key <key>     Firefly API key to pass via x-firefly-key header (optional)
  --skip-refine           Skip recipe refinement, only update images
  --skip-image            Skip image generation, only refine recipes
  -h, --help              Show this message
`;
  console.log(usageMessage.trim());
}

async function main() {
  try {
    const args = process.argv.slice(2);

    if (args.includes("--help") || args.includes("-h")) {
      printUsage();
      process.exit(0);
    }

    let endpoint = process.env.RECIPE_API_URL ?? "http://localhost:3000";
    let token: string | undefined;
    let fireflyKey: string | undefined;
    let skipRefine = false;
    let skipImage = false;

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === "--endpoint") {
        endpoint = args[i + 1];
        if (!endpoint) {
          throw new Error("--endpoint requires a URL argument");
        }
        i++;
      } else if (arg.startsWith("--endpoint=")) {
        endpoint = arg.split("=")[1];
      } else if (arg === "--token") {
        token = args[i + 1];
        if (!token) {
          throw new Error("--token requires a token argument");
        }
        i++;
      } else if (arg.startsWith("--token=")) {
        token = arg.split("=")[1];
      } else if (arg === "--firefly-key") {
        fireflyKey = args[i + 1];
        if (!fireflyKey) {
          throw new Error("--firefly-key requires a key argument");
        }
        i++;
      } else if (arg.startsWith("--firefly-key=")) {
        fireflyKey = arg.split("=")[1];
      } else if (arg === "--skip-refine") {
        skipRefine = true;
      } else if (arg === "--skip-image") {
        skipImage = true;
      } else {
        throw new Error(`Unknown argument: ${arg}`);
      }
    }

    // Load token if not provided
    if (!token) {
      token = await loadEnvValue("EDIT_TOKEN");
    }

    if (!token) {
      throw new Error(
        "Provide EDIT_TOKEN via --token, EDIT_TOKEN env var, or .env.local before running this script.",
      );
    }

    // Query database for recipes created today
    console.log("Querying database for recipes created today...\n");
    const supabaseAdmin = await getSupabaseAdmin();
    const recipes = await getRecipesCreatedToday(supabaseAdmin);

    if (recipes.length === 0) {
      console.log("No recipes found created today.");
      return;
    }

    console.log(`Found ${recipes.length} recipe(s) created today:\n`);
    for (const recipe of recipes) {
      const date = new Date(recipe.created_at).toLocaleString();
      console.log(`  - ${recipe.name} (${recipe.slug}) - Created: ${date}`);
    }
    console.log();

    // Process each recipe one by one
    for (let i = 0; i < recipes.length; i++) {
      const recipe = recipes[i];
      console.log(`\n[${i + 1}/${recipes.length}] Processing: ${recipe.name} (${recipe.slug})`);

      try {
        // Step 1: Refine recipe (if not skipped)
        if (!skipRefine) {
          console.log("  → Refining recipe...");
          const refineResult = await refineRecipe(recipe.slug, endpoint, token);
          console.log(`  ✓ ${refineResult.message}`);
          if (refineResult.evaluation) {
            console.log(`    Evaluation: ${refineResult.evaluation.substring(0, 100)}...`);
          }
        } else {
          console.log("  → Skipping refinement (--skip-refine)");
        }

        // Step 2: Generate/update image (if not skipped)
        if (!skipImage) {
          console.log("  → Generating image...");
          const imageResult = await generateImage(recipe.slug, endpoint, token, fireflyKey);
          console.log(`  ✓ ${imageResult.message}`);
          console.log(`    Image URL: ${imageResult.publicUrl}`);
        } else {
          console.log("  → Skipping image generation (--skip-image)");
        }

        console.log(`  ✓ Completed: ${recipe.name}`);
      } catch (error) {
        console.error(
          `  ✗ Error processing ${recipe.name}:`,
          error instanceof Error ? error.message : String(error),
        );
        // Continue with next recipe
      }
    }

    console.log(`\n✓ Finished processing ${recipes.length} recipe(s).`);
  } catch (error) {
    console.error(`[refine-today-recipes] ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

void main();
