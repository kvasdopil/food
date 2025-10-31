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

type GenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
};

type CliOptions = {
  mealName: string;
  description: string;
  tags: string[];
  styleHints?: string;
  servings?: number;
  cuisine?: string;
};

const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const TEXT_MODEL = "gemini-2.5-flash";
const OUTPUT_BASE = path.resolve(process.cwd(), "data/recipes");

const recipeSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    servings: { type: "integer" },
    prepTimeMinutes: { type: "integer" },
    cookTimeMinutes: { type: "integer" },
    ingredients: {
      type: "array",
      minItems: 6,
      items: {
        type: "object",
        required: ["name", "amount"],
        properties: {
          name: { type: "string" },
          amount: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
    instructions: {
      type: "array",
      minItems: 4,
      items: {
        type: "object",
        required: ["step", "action"],
        properties: {
          step: { type: "integer" },
          action: { type: "string" },
        },
      },
    },
    tags: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["title", "ingredients", "instructions"],
} as const;

async function callGemini(model: string, body: Record<string, unknown>, apiKey: string) {
  const url = `${API_BASE_URL}/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini API request failed (${response.status} ${response.statusText}): ${errorText}`,
    );
  }

  return (await response.json()) as GenerateContentResponse;
}

function ensureText(response: GenerateContentResponse, errorContext: string) {
  if (response.promptFeedback?.blockReason) {
    throw new Error(
      `${errorContext} was blocked by Gemini: ${response.promptFeedback.blockReason}`,
    );
  }
  const text = response.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error(`Gemini did not return text for: ${errorContext}`);
  }

  return text;
}

async function generateRecipe(options: CliOptions, apiKey: string): Promise<RecipeData> {
  const prompts: string[] = [
    `Develop a detailed recipe for "${options.mealName}".`,
    `Core description provided by the product team: ${options.description}`,
    "The dish must be achievable in 60 minutes or less using widely available, budget-friendly ingredients.",
    "Include a short summary sentence that captures the flavor and vibe of the meal.",
    'Use metric measurements with abbreviated units (g, ml, °C) plus tsp/tbsp where helpful. You may use "1 medium", "2 large", etc., for whole produce where that feels natural. Never use Fahrenheit, pounds, ounces, cups, or inches.',
    "Keep instruction references aligned with the ingredient list, with the exception of common pantry staples (salt, pepper, oil, water, basic seasonings) which can be mentioned as needed.",
    "Describe tiny amounts (a drizzle of olive oil, a pinch of salt) naturally instead of inventing precise measurements.",
    "In the instructions, wrap the first occurrence of each ingredient name per step in asterisks like *ingredient*, and reference ingredients using lowercase wording rather than Title Case.",
    "Return the recipe structured JSON matching the provided schema.",
    "If you mention a side or garnish, keep it quick to prepare.",
  ];

  if (options.servings) {
    prompts.push(`Target servings: ${options.servings}.`);
  }

  if (options.cuisine) {
    prompts.push(`Cuisine influence: ${options.cuisine}.`);
  }

  prompts.push(
    [
      `You must reference only the following tags when relevant (do not invent new tags): ${options.tags.join(", ")}.`,
      "If a provided tag does not apply, omit it rather than creating alternatives.",
    ].join(" "),
  );

  if (options.styleHints) {
    prompts.push(`Incorporate these extra notes: ${options.styleHints}.`);
  }

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompts.join("\n"),
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: recipeSchema,
      temperature: 0.6,
    },
  };

  const response = await callGemini(TEXT_MODEL, requestBody, apiKey);
  const jsonText = ensureText(response, "Recipe generation");

  try {
    return JSON.parse(jsonText) as RecipeData;
  } catch (error) {
    throw new Error(
      `Failed to parse recipe JSON: ${(error as Error).message}\nRaw output:\n${jsonText}`,
    );
  }
}

async function enhanceImagePrompt(recipe: RecipeData, basePrompt: string, apiKey: string) {
  const descriptiveIngredients = recipe.ingredients
    .slice(0, 6)
    .map((item) => item.name)
    .join(", ");
  const stepsPreview = recipe.instructions
    .slice(0, 3)
    .map((instruction) => instruction.action)
    .join(" ");

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "You are a culinary art director crafting vivid food photography prompts.",
              `Current meal: ${recipe.title}.`,
              recipe.summary ? `Flavor summary: ${recipe.summary}.` : "",
              `Key ingredients: ${descriptiveIngredients}.`,
              `Cooking approach: ${stepsPreview}.`,
              "Elevate the provided base image brief so it sounds mouthwatering, specifying plating, garnish, lighting, and camera perspective.",
              "Keep it under 80 words, omit brand names, and do not add people or utensils in hands.",
              `Base prompt: ${basePrompt}`,
              "Return only the enhanced prompt text.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
    },
  };

  const response = await callGemini(TEXT_MODEL, requestBody, apiKey);
  return ensureText(response, "Image prompt enhancement");
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

async function loadEnvKey() {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  if (process.env.GOOGLE_API_KEY) {
    return process.env.GOOGLE_API_KEY;
  }

  const envLocalPath = path.resolve(".env.local");

  try {
    const content = await fs.readFile(envLocalPath, "utf-8");
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim();
      if (!value) continue;

      if (key === "GEMINI_API_KEY") {
        process.env.GEMINI_API_KEY = value;
        return value;
      }
      if (key === "GOOGLE_API_KEY") {
        process.env.GOOGLE_API_KEY = value;
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
    const apiKey = await loadEnvKey();

    if (!apiKey) {
      throw new Error(
        "Provide GEMINI_API_KEY (or GOOGLE_API_KEY) via env or .env.local before running this script.",
      );
    }

    const recipe = await generateRecipe(options, apiKey);
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

    const nonSettingTags = new Set([
      "vegetarian",
      "vegan",
      "spicy",
      "glutenfree",
      "gluten-free",
      "seafood",
      "beef",
      "chicken",
      "pork",
      "lamb",
      "dairy",
      "legumes",
      "tofu",
      "plant-based",
    ]);
    const cuisineTag = options.tags.find((tag) => !nonSettingTags.has(tag.toLowerCase())) ?? "";
    const tableSetting = cuisineTag
      ? `${cuisineTag.toLowerCase()}-inspired table`
      : "rustic dining table";

    const baseImagePrompt = [
      `Vibrant close-up of ${recipe.title}, plated to showcase vivid textures and color.`,
      `Incorporate visual cues from this description: ${recipe.summary}.`,
      `Scene: ${tableSetting} with soft natural daylight, eye-level perspective, and shallow depth of field.`,
      "Capture fresh garnish, inviting lighting, and a sense of homemade comfort with no visible steam or vapor. No people or branded props.",
    ].join(" ");

    const enhancedImagePrompt = await enhanceImagePrompt(recipe, baseImagePrompt, apiKey);

    const yamlFile = path.join(recipeDir, `${slug}.yaml`);
    await fs.writeFile(
      yamlFile,
      toYaml(recipe, {
        imagePrompt: {
          base: baseImagePrompt,
          enhanced: enhancedImagePrompt,
        },
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
