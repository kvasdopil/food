import { promises as fs } from "node:fs";
import path from "node:path";

import yaml from "js-yaml";

type SeedRecord = {
  slug: string;
  name: string;
  description: string;
  ingredients: string;
  instructions: string;
  imagePath: string;
  tags: string[];
};

const STORAGE_BUCKET = process.env.RECIPE_STORAGE_BUCKET ?? "recipe-images";

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}

function buildTagsSql(tags: string[]) {
  if (!tags.length) return "array[]::text[]";
  return `array[${tags.map((tag) => `'${escapeSql(tag)}'`).join(", ")}]`;
}

async function loadGeneratedSeeds(): Promise<SeedRecord[]> {
  const baseDir = path.resolve("data/recipes");
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  const seeds: SeedRecord[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const recipeDir = path.join(baseDir, slug);
    const yamlPath = path.join(recipeDir, `${slug}.yaml`);

    try {
      const yamlContent = await fs.readFile(yamlPath, "utf-8");
      const data = yaml.load(yamlContent) as Record<string, unknown>;
      const ingredients = (data.ingredients as Array<Record<string, string>>) ?? [];
      const instructions = (data.instructions as Array<Record<string, string>>) ?? [];
      const tags = (data.tags as string[]) ?? [];

      const ingredientObjects = ingredients
        .map((item) => ({
          name: String(item.name ?? "").trim(),
          amount: item.amount ? String(item.amount).trim() : undefined,
          notes: item.notes ? String(item.notes).trim() : undefined,
        }))
        .filter((item) => item.name.length > 0);

      seeds.push({
        slug,
        name: String(data.title ?? slug),
        description: String(data.summary ?? ""),
        ingredients: JSON.stringify(ingredientObjects),
        instructions: instructions
          .map((step) => `${step.step}. ${step.action}`)
          .join("\n"),
        imagePath: `${STORAGE_BUCKET}/${slug}.jpg`,
        tags,
      });
    } catch (error) {
      console.warn(`Skipping ${slug}: ${(error as Error).message}`);
    }
  }

  return seeds.sort((a, b) => a.slug.localeCompare(b.slug));
}

function recordToSql(record: SeedRecord) {
  return `  ('${escapeSql(record.slug)}', '${escapeSql(record.name)}', '${escapeSql(record.description)}', '${escapeSql(record.ingredients)}', '${escapeSql(record.instructions)}', '${escapeSql(record.imagePath)}', ${buildTagsSql(record.tags)})`;
}

async function main() {
  const allSeeds = await loadGeneratedSeeds();
  console.log(`Loaded ${allSeeds.length} recipes from data directory.`);

  const sql = [
    "insert into public.recipes (slug, name, description, ingredients, instructions, image_url, tags)",
    "values",
    allSeeds.map(recordToSql).join(",\n"),
    "",
    "on conflict (slug) do update set",
    "  name = excluded.name,",
    "  description = excluded.description,",
    "  ingredients = excluded.ingredients,",
    "  instructions = excluded.instructions,",
    "  image_url = excluded.image_url,",
    "  tags = excluded.tags;",
    "",
  ].join("\n");

  const targetPath = path.resolve("supabase/seed.sql");
  await fs.writeFile(targetPath, sql, "utf-8");
  console.log(`Updated ${targetPath} with ${allSeeds.length} records.`);
}

void main();
