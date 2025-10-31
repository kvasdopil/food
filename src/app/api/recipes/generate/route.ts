import { NextResponse, type NextRequest } from "next/server";

const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const TEXT_MODEL = "gemini-2.5-flash";

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

type GenerateRequest = {
  title: string;
  description: string;
  tags: string[];
  userComment?: string;
  servings?: number;
  cuisine?: string;
};

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

async function generateRecipe(options: GenerateRequest, apiKey: string): Promise<RecipeData> {
  const prompts: string[] = [
    `Develop a detailed recipe for "${options.title}".`,
    `Core description provided by the product team: ${options.description}`,
    "The dish must be achievable in 60 minutes or less using widely available, budget-friendly ingredients.",
    "Include a short summary sentence that captures the flavor and vibe of the meal.",
    "",
    "CRITICAL FORMATTING RULES (must be followed exactly):",
    "",
    "1. INGREDIENT NAMES:",
    "   - All ingredient names in the ingredients array MUST be lowercase (e.g., 'chicken breast', not 'Chicken Breast')",
    "   - Ingredient amounts must NOT contain parenthetical notes; move all contextual details to the 'notes' field",
    "   - Example: { name: 'chicken breast', amount: '4', notes: 'approx. 150g each' } NOT { name: 'Chicken breast', amount: '4 (approx. 150g each)' }",
    "",
    "2. INSTRUCTIONS:",
    "   - Wrap ONLY the FIRST occurrence of each ingredient name per step in asterisks (e.g., '*chicken breast*')",
    "   - Subsequent mentions of the same ingredient in the same step should NOT have asterisks",
    "   - It's okay to use descriptive phrases in instructions (e.g., '*trimmed green beans*', '*minced garlic*') for clarity",
    "   - Keep instruction text concise and practical",
    "",
    "3. MEASUREMENTS:",
    '   - Use metric measurements with abbreviated units (g, ml, °C) plus tsp/tbsp where helpful',
    '   - You may use "1 medium", "2 large", etc., for whole produce where that feels natural',
    '   - Never use Fahrenheit, pounds, ounces, cups, or inches',
    "   - Describe tiny amounts (a drizzle, a pinch) naturally instead of inventing precise measurements",
    "",
    "4. INGREDIENT REFERENCING:",
    "   - Instructions should reference ingredients from the ingredient list",
    "   - Common pantry staples (salt, pepper, oil, water, basic seasonings) can be mentioned without explicit listing in ingredients",
    "",
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

  if (options.userComment) {
    prompts.push(`Incorporate these extra notes: ${options.userComment}.`);
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function POST(request: NextRequest) {
  const editToken = process.env.EDIT_TOKEN;
  if (!editToken) {
    console.error("POST /api/recipes/generate missing EDIT_TOKEN environment variable.");
    return NextResponse.json({ error: "Server is not configured for edits" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const tokenMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  const providedToken = tokenMatch ? tokenMatch[1].trim() : null;

  if (!providedToken || providedToken !== editToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("POST /api/recipes/generate missing GEMINI_API_KEY or GOOGLE_API_KEY.");
    return NextResponse.json(
      { error: "Server is not configured for recipe generation" },
      { status: 500 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch (error) {
    console.error("Invalid JSON payload:", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !json ||
    typeof json !== "object" ||
    !("title" in json) ||
    !("description" in json) ||
    !("tags" in json)
  ) {
    return NextResponse.json(
      { error: "Payload must include title, description, and tags." },
      { status: 400 },
    );
  }

  const payload = json as Record<string, unknown>;
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const tagsInput = Array.isArray(payload.tags) ? payload.tags : [];
  const tags = tagsInput
    .map((tag) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
    .filter(Boolean);

  if (!title || !description || tags.length === 0) {
    return NextResponse.json(
      { error: "Title, description, and at least one tag are required." },
      { status: 400 },
    );
  }

  const userComment =
    typeof payload.userComment === "string" ? payload.userComment.trim() : undefined;
  const servings =
    typeof payload.servings === "number" && Number.isFinite(payload.servings)
      ? payload.servings
      : undefined;
  const cuisine = typeof payload.cuisine === "string" ? payload.cuisine.trim() : undefined;

  try {
    const generateOptions: GenerateRequest = {
      title,
      description,
      tags,
      userComment,
      servings,
      cuisine,
    };

    const recipe = await generateRecipe(generateOptions, apiKey);
    recipe.title = title;
    recipe.summary = description;
    recipe.tags = [...tags];

    // Normalize ingredient names to lowercase
    recipe.ingredients = recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      name: ingredient.name.toLowerCase().trim(),
      // Ensure amounts don't have parenthetical notes
      amount: ingredient.amount.split("(")[0].trim(),
      notes: ingredient.notes
        ? ingredient.notes.trim()
        : ingredient.amount.includes("(")
          ? ingredient.amount.split("(").slice(1).join("(").replace(/\)$/, "").trim()
          : undefined,
    })).filter(ing => ing.amount); // Remove any invalid entries

    // Normalize instructions
    recipe.instructions = recipe.instructions.map((instruction, index) => ({
      step: index + 1,
      action: instruction.action.trim(),
    }));

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
    const cuisineTag = tags.find((tag) => !nonSettingTags.has(tag.toLowerCase())) ?? "";
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

    const slug = slugify(recipe.title || title);

    // Format response to match POST /api/recipes format
    // Includes generated fields that can be used to create a recipe via POST /api/recipes
    const recipeResponse = {
      slug,
      name: recipe.title,
      description: recipe.summary ?? null,
      tags: recipe.tags ?? [],
      image_url: null,
      // Additional generated fields for creating the recipe
      title: recipe.title,
      summary: recipe.summary ?? null,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      servings: recipe.servings ?? null,
      prepTimeMinutes: recipe.prepTimeMinutes ?? null,
      cookTimeMinutes: recipe.cookTimeMinutes ?? null,
      imagePrompt: {
        base: baseImagePrompt,
        enhanced: enhancedImagePrompt,
      },
    };

    return NextResponse.json({ recipe: recipeResponse }, { status: 200 });
  } catch (error) {
    console.error("Failed to generate recipe:", error);
    return NextResponse.json(
      { error: `Failed to generate recipe: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}
