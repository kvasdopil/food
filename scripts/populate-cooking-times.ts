#!/usr/bin/env ts-node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { createClient } from "@supabase/supabase-js";

const DATA_DIR = path.join(process.cwd(), "data", "recipes");

type RecipeYaml = {
  title?: unknown;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
};

async function loadEnvValue(key: string): Promise<string | undefined> {
  const envValue = process.env[key];
  if (envValue) {
    return envValue;
  }

  const envPath = path.resolve(process.cwd(), ".env.local");

  try {
    const content = await readFile(envPath, "utf-8");
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const [lhs, ...rhs] = line.split("=");
      if (!lhs || rhs.length === 0) continue;
      const currentKey = lhs.trim();
      if (currentKey !== key) continue;
      const value = rhs.join("=").trim();
      if (value) {
        return value;
      }
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      console.warn(`Failed to read .env.local: ${err.message}`);
    }
  }

  return undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function getAllYamlFiles(): Promise<string[]> {
  const yamlFiles: string[] = [];
  const recipeDirs = await readdir(DATA_DIR, { withFileTypes: true });

  for (const dir of recipeDirs) {
    if (!dir.isDirectory()) continue;

    const dirPath = path.join(DATA_DIR, dir.name);
    const files = await readdir(dirPath);

    const yamlFile = files.find((file) => file.endsWith(".yaml") || file.endsWith(".yml"));

    if (yamlFile) {
      yamlFiles.push(path.join(dirPath, yamlFile));
    }
  }

  return yamlFiles;
}

async function extractCookingTimes(yamlPath: string): Promise<{
  slug: string;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
}> {
  const fileContent = await readFile(yamlPath, "utf-8");
  const data = yaml.load(fileContent) as RecipeYaml;

  if (typeof data !== "object" || data === null) {
    throw new Error(`Invalid YAML in ${yamlPath}`);
  }

  // Extract slug from directory name or title
  const dirName = path.basename(path.dirname(yamlPath));
  const slug = dirName || (typeof data.title === "string" ? slugify(data.title) : "");

  const prepTimeMinutes =
    typeof data.prepTimeMinutes === "number" && data.prepTimeMinutes > 0
      ? data.prepTimeMinutes
      : null;

  const cookTimeMinutes =
    typeof data.cookTimeMinutes === "number" && data.cookTimeMinutes > 0
      ? data.cookTimeMinutes
      : null;

  return { slug, prepTimeMinutes, cookTimeMinutes };
}

async function main(): Promise<void> {
  const supabaseUrl = await loadEnvValue("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseServiceKey = await loadEnvValue("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(
      "Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
    console.error("Provide via env vars or .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Loading YAML files...");
  const yamlFiles = await getAllYamlFiles();
  console.log(`Found ${yamlFiles.length} YAML files\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const yamlFile of yamlFiles) {
    try {
      const { slug, prepTimeMinutes, cookTimeMinutes } = await extractCookingTimes(yamlFile);

      if (!slug) {
        console.warn(`⚠ Skipping ${yamlFile}: could not determine slug`);
        skipped++;
        continue;
      }

      // Check if recipe exists
      const { data: existingRecipe, error: fetchError } = await supabase
        .from("recipes")
        .select("slug, prep_time_minutes, cook_time_minutes")
        .eq("slug", slug)
        .maybeSingle();

      if (fetchError) {
        console.error(`✗ Error fetching ${slug}: ${fetchError.message}`);
        errors++;
        continue;
      }

      if (!existingRecipe) {
        console.warn(`⚠ Recipe not found in database: ${slug}`);
        skipped++;
        continue;
      }

      // Skip if both times are already set and match (or if YAML has no times)
      if (
        prepTimeMinutes === null &&
        cookTimeMinutes === null &&
        existingRecipe.prep_time_minutes !== null &&
        existingRecipe.cook_time_minutes !== null
      ) {
        console.log(`⊘ Skipping ${slug}: no times in YAML, DB already has times`);
        skipped++;
        continue;
      }

      // Update the recipe
      const updates: {
        prep_time_minutes?: number | null;
        cook_time_minutes?: number | null;
      } = {};

      if (prepTimeMinutes !== null) {
        updates.prep_time_minutes = prepTimeMinutes;
      }

      if (cookTimeMinutes !== null) {
        updates.cook_time_minutes = cookTimeMinutes;
      }

      // Only update if we have something to set
      if (Object.keys(updates).length === 0) {
        console.log(`⊘ Skipping ${slug}: no times to update`);
        skipped++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("recipes")
        .update(updates)
        .eq("slug", slug);

      if (updateError) {
        console.error(`✗ Error updating ${slug}: ${updateError.message}`);
        errors++;
        continue;
      }

      const timesStr = [
        prepTimeMinutes !== null ? `${prepTimeMinutes}m prep` : null,
        cookTimeMinutes !== null ? `${cookTimeMinutes}m cook` : null,
      ]
        .filter(Boolean)
        .join(", ");

      console.log(`✓ Updated ${slug}: ${timesStr}`);
      updated++;
    } catch (error) {
      console.error(
        `✗ Error processing ${yamlFile}: ${error instanceof Error ? error.message : String(error)}`,
      );
      errors++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`✓ Updated: ${updated}`);
  console.log(`⊘ Skipped: ${skipped}`);
  console.log(`✗ Errors: ${errors}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal error: ${message}`);
  process.exit(1);
});
