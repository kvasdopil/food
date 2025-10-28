import { promises as fs } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import yaml from "js-yaml";

type RecipeRow = {
  slug: string;
  name: string;
  description: string;
  ingredients: string;
  instructions: string;
  image_url: string;
  tags: string[];
};

const STORAGE_BUCKET = process.env.RECIPE_STORAGE_BUCKET ?? "recipe-images";
const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be set.",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const staticSeeds: RecipeRow[] = [
  {
    slug: "smoky-chickpea-stew",
    name: "Smoky Chickpea Stew",
    description:
      "A hearty, smoky tomato-based stew with chickpeas, roasted peppers, and greens.",
    ingredients: [
      "1 tbsp olive oil",
      "1 yellow onion, diced",
      "3 cloves garlic, minced",
      "1 roasted red pepper, sliced",
      "2 cups cooked chickpeas",
      "1 can (14 oz) crushed tomatoes",
      "2 cups vegetable broth",
      "1 tsp smoked paprika",
      "1 tsp ground cumin",
      "1/2 tsp chili flakes",
      "2 cups chopped kale",
      "Salt and pepper to taste",
    ].join("\n"),
    instructions: [
      "1. Warm olive oil in a dutch oven over medium heat. Add onion and cook until translucent.",
      "2. Stir in garlic, roasted pepper, chickpeas, smoked paprika, cumin, and chili flakes; cook 2 minutes.",
      "3. Pour in crushed tomatoes and broth. Simmer 15 minutes.",
      "4. Fold in kale and cook until wilted. Season with salt and pepper. Serve hot.",
    ].join("\n"),
    image_url:
      "https://images.unsplash.com/photo-1481931715705-36f9091d1661?auto=format&fit=crop&w=800&q=80",
    tags: ["vegan", "comfort", "30-minute"],
  },
  {
    slug: "summer-panzanella",
    name: "Summer Panzanella",
    description:
      "A bright Italian bread salad with juicy tomatoes, cucumbers, and basil tossed in a garlicky vinaigrette.",
    ingredients: [
      "4 cups day-old sourdough, cubed",
      "1/4 cup olive oil",
      "1 clove garlic, grated",
      "3 large heirloom tomatoes, chopped",
      "1 cucumber, sliced",
      "1/2 red onion, thinly sliced",
      "1/4 cup capers, rinsed",
      "1/2 cup fresh basil leaves",
      "2 tbsp red wine vinegar",
      "Salt and black pepper to taste",
    ].join("\n"),
    instructions: [
      "1. Toss bread cubes with half the olive oil and toast in a skillet until crisp.",
      "2. Combine tomatoes, cucumber, onion, capers, and basil in a large bowl.",
      "3. Whisk remaining olive oil with garlic and vinegar; season with salt and pepper.",
      "4. Add toasted bread to vegetables, drizzle dressing, toss to coat, and let rest 10 minutes before serving.",
    ].join("\n"),
    image_url:
      "https://images.unsplash.com/photo-1473093226795-af9932fe5856?auto=format&fit=crop&w=800&q=80",
    tags: ["vegetarian", "salad", "summer"],
  },
  {
    slug: "miso-butter-salmon",
    name: "Miso Butter Salmon",
    description:
      "Roasted salmon fillets glazed with a savory miso butter and served with quick pickled cucumbers.",
    ingredients: [
      "4 salmon fillets",
      "2 tbsp white miso paste",
      "2 tbsp softened butter",
      "1 tbsp maple syrup",
      "1 tbsp soy sauce",
      "1 tsp grated ginger",
      "Juice of 1/2 lemon",
      "2 cups cooked rice, for serving",
      "1 cucumber, thinly sliced",
      "2 tbsp rice vinegar",
      "1 tsp sesame oil",
      "Sesame seeds and scallions for garnish",
    ].join("\n"),
    instructions: [
      "1. Heat oven to 400°F (205°C). Line a sheet pan with parchment.",
      "2. Stir miso, butter, maple syrup, soy sauce, ginger, and lemon juice into a smooth glaze.",
      "3. Arrange salmon on the pan, spread glaze over fillets, and roast 10-12 minutes until flaky.",
      "4. Toss cucumber with rice vinegar, sesame oil, and a pinch of salt; let marinate while salmon cooks.",
      "5. Serve salmon over rice with pickled cucumbers, scallions, and sesame seeds.",
    ].join("\n"),
    image_url:
      "https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=800&q=80",
    tags: ["seafood", "weeknight", "gluten-free"],
  },
];

async function loadGeneratedSeeds(): Promise<RecipeRow[]> {
  const baseDir = path.resolve("data/recipes");
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  const seeds: RecipeRow[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const recipeDir = path.join(baseDir, slug);
    const yamlPath = path.join(recipeDir, `${slug}.yaml`);

    try {
      const yamlContent = await fs.readFile(yamlPath, "utf-8");
      const data = yaml.load(yamlContent) as Record<string, unknown>;
      const ingredientsData = (data.ingredients as Array<Record<string, string>>) ?? [];
      const instructionsData = (data.instructions as Array<Record<string, string>>) ?? [];
      const tags = (data.tags as string[]) ?? [];

      seeds.push({
        slug,
        name: String(data.title ?? slug),
        description: String(data.summary ?? ""),
        ingredients: ingredientsData
          .map((item) => {
            const notes = item.notes ? ` (${item.notes})` : "";
            return `${item.amount} ${item.name}${notes}`.trim();
          })
          .join("\n"),
        instructions: instructionsData
          .map((step) => `${step.step}. ${step.action}`)
          .join("\n"),
        image_url: `${STORAGE_BUCKET}/${slug}.jpg`,
        tags,
      });
    } catch (error) {
      console.warn(`Skipping ${slug}: ${(error as Error).message}`);
    }
  }

  return seeds.sort((a, b) => a.slug.localeCompare(b.slug));
}

async function main() {
  const generatedSeeds = await loadGeneratedSeeds();
  const payload = [...staticSeeds, ...generatedSeeds];

  const { error } = await supabase
    .from("recipes")
    .upsert(payload, { onConflict: "slug" });

  if (error) {
    throw new Error(`Failed to upsert recipes: ${error.message}`);
  }

  console.log(`Upserted ${payload.length} recipes.`);
}

void main();

