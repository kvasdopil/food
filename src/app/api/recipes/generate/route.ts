import { NextResponse, type NextRequest } from "next/server";
import { callGemini, ensureText, TEXT_MODEL } from "@/lib/gemini";
import { buildRecipeGenerationPrompt, recipeSchema, type GenerateRequest } from "@/lib/prompts/recipe-generation";
import {
  type RecipeData,
  normalizeRecipe,
  slugify,
} from "@/lib/recipe-utils";

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

    // Generate recipe (first variant only)
    let recipe = await generateRecipe(generateOptions, apiKey);
    recipe.title = title;
    recipe.summary = description;
    recipe.tags = [...tags];
    recipe = normalizeRecipe(recipe);

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

async function generateRecipe(
  options: GenerateRequest,
  apiKey: string,
): Promise<RecipeData> {
  const prompt = buildRecipeGenerationPrompt(options);

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt,
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
