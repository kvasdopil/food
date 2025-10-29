import { promises as fs } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import yaml from "js-yaml";

const STORAGE_BUCKET = process.env.RECIPE_STORAGE_BUCKET ?? "recipe-images";

function loadEnvOrThrow(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

type Ingredient = {
  name: string;
  amount?: string;
  notes?: string;
};

type RecipePayload = {
  slug: string;
  name: string;
  description: string;
  ingredients: string;
  instructions: string;
  image_url: string;
  tags: string[];
};

async function loadRecipes(): Promise<RecipePayload[]> {
  const baseDir = path.resolve("data/recipes");
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  const recipes: RecipePayload[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const yamlPath = path.join(baseDir, slug, `${slug}.yaml`);

    try {
      const yamlContent = await fs.readFile(yamlPath, "utf-8");
      const data = yaml.load(yamlContent) as Record<string, unknown>;
      const ingredients = (data.ingredients as Ingredient[]) ?? [];
      const instructions = (data.instructions as Array<Record<string, string>>) ?? [];
      const tags = (data.tags as string[]) ?? [];

      const serializedIngredients = JSON.stringify(
        ingredients
          .map((item) => ({
            name: String(item.name ?? "").trim(),
            amount: item.amount ? String(item.amount).trim() : undefined,
            notes: item.notes ? String(item.notes).trim() : undefined,
          }))
          .filter((item) => item.name.length > 0),
      );

      recipes.push({
        slug,
        name: String(data.title ?? slug),
        description: String(data.summary ?? ""),
        ingredients: serializedIngredients,
        instructions: instructions.map((step) => `${step.step}. ${step.action}`).join("\n"),
        image_url: `${STORAGE_BUCKET}/${slug}.jpg`,
        tags,
      });
    } catch (error) {
      console.warn(`Skipping ${slug}: ${(error as Error).message}`);
    }
  }

  return recipes.sort((a, b) => a.slug.localeCompare(b.slug));
}

async function main() {
  const supabaseUrl = loadEnvOrThrow("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = loadEnvOrThrow("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const recipes = await loadRecipes();

  const { error } = await supabase.from("recipes").upsert(recipes, { onConflict: "slug" });

  if (error) {
    throw error;
  }

  console.log(`Upserted ${recipes.length} recipes.`);
}

void main();
