import { promises as fs } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

type Ingredient = {
  name: string;
  amount: string;
  notes?: string;
};

type Instruction = {
  step: number;
  action: string;
};

type RecipeData = {
  title: string;
  summary?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  ingredients: Ingredient[];
  instructions: Instruction[];
  tags?: string[];
};

type CliOptions = {
  mealName: string;
  description: string;
  tags: string[];
  styleHints?: string;
  servings?: number;
  cuisine?: string;
  endpoint?: string;
};

const OUTPUT_BASE = path.resolve(process.cwd(), "data/recipes");

type GenerateRecipeResponse = {
  recipe: {
    slug: string;
    name: string;
    description: string | null;
    tags: string[];
    title: string;
    summary: string | null;
    ingredients: Ingredient[];
    instructions: Instruction[];
    servings: number | null;
    prepTimeMinutes: number | null;
    cookTimeMinutes: number | null;
    imagePrompt: {
      base: string;
      enhanced: string;
    };
  };
};

async function generateRecipe(
  options: CliOptions,
  endpoint: string,
  token: string,
): Promise<{ recipe: RecipeData; imagePrompt: { base: string; enhanced: string } }> {
  const url = `${endpoint}/api/recipes/generate`;
  const requestBody = {
    title: options.mealName,
    description: options.description,
    tags: options.tags,
    userComment: options.styleHints,
    servings: options.servings,
    cuisine: options.cuisine,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Recipe generation API failed (${response.status} ${response.statusText}): ${errorText}`,
    );
  }

  const data = (await response.json()) as GenerateRecipeResponse;

  return {
    recipe: {
      title: data.recipe.title,
      summary: data.recipe.summary ?? undefined,
      servings: data.recipe.servings ?? undefined,
      prepTimeMinutes: data.recipe.prepTimeMinutes ?? undefined,
      cookTimeMinutes: data.recipe.cookTimeMinutes ?? undefined,
      ingredients: data.recipe.ingredients,
      instructions: data.recipe.instructions,
      tags: data.recipe.tags,
    },
    imagePrompt: data.recipe.imagePrompt,
  };
}

function parseArgs(argv: string[]): CliOptions {
  const options: Partial<CliOptions> = {
    tags: [],
  };

  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--style":
        options.styleHints = (argv[index + 1] ?? "").trim();
        index += 1;
        break;
      case "--servings":
        options.servings = Number.parseInt(argv[index + 1] ?? "", 10);
        index += 1;
        break;
      case "--cuisine":
        options.cuisine = (argv[index + 1] ?? "").trim();
        index += 1;
        break;
      case "--description":
        options.description = (argv[index + 1] ?? "").trim();
        index += 1;
        break;
      case "--tags":
        options.tags = (argv[index + 1] ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);
        index += 1;
        break;
      case "--endpoint":
        options.endpoint = (argv[index + 1] ?? "").trim();
        index += 1;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
        break;
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown option: ${arg}`);
        }
        positional.push(arg);
        break;
    }
  }

  if (!positional.length) {
    throw new Error(
      'Please supply a meal name (e.g. yarn ts-node scripts/generate-recipe-yaml.ts "Margherita Pizza").',
    );
  }

  options.mealName = positional.join(" ").trim();

  if (!options.mealName) {
    throw new Error("Meal name cannot be empty.");
  }
  if (!options.description) {
    throw new Error('Please provide --description "<text>" for the meal.');
  }
  if (!options.tags || options.tags.length === 0) {
    throw new Error('Please provide at least one tag via --tags "tag1,tag2".');
  }

  return options as CliOptions;
}

async function loadEnvValue(key: string): Promise<string | undefined> {
  if (process.env[key]) {
    return process.env[key];
  }

  const envLocalPath = path.resolve(".env.local");

  try {
    const content = await fs.readFile(envLocalPath, "utf-8");
    const lines = content.split(/\r?\n/);

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
    // ignore missing file
  }

  return undefined;
}

function printUsage() {
  const usageMessage = `
Usage: ts-node scripts/generate-recipe-yaml.ts "Meal Name" [options]

Options:
  --style "<notes>"       Extra guidance for flavor, texture, or dietary goals.
  --servings <number>     Target serving count.
  --cuisine "<style>"     Cuisine influence to emphasize.
  --description "<text>"  Required: human-written description of the meal.
  --tags "tag1,tag2"      Required: comma-separated tags (e.g. gluten-free, spicy).
  --endpoint "<url>"      API endpoint URL (defaults to http://localhost:3000).
  -h, --help              Show this message.
`;
  console.log(usageMessage.trim());
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toYaml(
  recipe: RecipeData,
  options: {
    imagePrompt: {
      base: string;
      enhanced: string;
    };
  },
) {
  const payload: Record<string, unknown> = {
    title: recipe.title,
  };

  if (recipe.summary) {
    payload.summary = recipe.summary;
  }
  if (recipe.servings) {
    payload.servings = recipe.servings;
  }
  if (recipe.prepTimeMinutes) {
    payload.prepTimeMinutes = recipe.prepTimeMinutes;
  }
  if (recipe.cookTimeMinutes) {
    payload.cookTimeMinutes = recipe.cookTimeMinutes;
  }

  payload.ingredients = recipe.ingredients.map((ingredient) => {
    const entry: Record<string, string> = {
      name: ingredient.name,
      amount: ingredient.amount,
    };
    if (ingredient.notes) {
      entry.notes = ingredient.notes;
    }
    return entry;
  });

  payload.instructions = recipe.instructions.map((instruction) => ({
    step: instruction.step,
    action: instruction.action,
  }));

  if (recipe.tags?.length) {
    payload.tags = recipe.tags;
  }

  payload.imagePrompt = options.imagePrompt;

  return `${yaml.dump(payload)}
`;
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const token = await loadEnvValue("EDIT_TOKEN");

    if (!token) {
      throw new Error("Provide EDIT_TOKEN via env or .env.local before running this script.");
    }

    const endpoint = options.endpoint || process.env.RECIPE_API_URL || "http://localhost:3000";

    const { recipe, imagePrompt } = await generateRecipe(options, endpoint, token);
    recipe.title = options.mealName;
    recipe.summary = options.description;
    recipe.tags = [...options.tags];
    recipe.instructions = recipe.instructions.map((instruction, index) => ({
      step: index + 1,
      action: instruction.action.trim(),
    }));

    const slug = slugify(recipe.title || options.mealName);
    const recipeDir = path.join(OUTPUT_BASE, slug);
    await fs.mkdir(recipeDir, { recursive: true });

    const yamlFile = path.join(recipeDir, `${slug}.yaml`);
    await fs.writeFile(
      yamlFile,
      toYaml(recipe, {
        imagePrompt,
      }),
      "utf-8",
    );

    console.log(`Recipe YAML saved to ${yamlFile}`);
    console.log("\nIngredients:");
    recipe.ingredients.forEach((ingredient) => {
      console.log(
        `- ${ingredient.amount} ${ingredient.name}${ingredient.notes ? ` (${ingredient.notes})` : ""}`,
      );
    });
    console.log("\nInstructions:");
    recipe.instructions.forEach((instruction) => {
      console.log(`${instruction.step}. ${instruction.action}`);
    });
  } catch (error) {
    console.error(`[generate-recipe-yaml] ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

void main();
