import { NextResponse, type NextRequest } from "next/server";
import { callGemini, ensureText, TEXT_MODEL } from "@/lib/gemini";
import {
  buildRecipeGenerationPrompt,
  recipeSchema,
  type GenerateRequest,
} from "@/lib/prompts/recipe-generation";
import { type RecipeData, normalizeRecipe, slugify } from "@/lib/recipe-utils";
import { authenticateRequest } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  // Authenticate the request - allows either EDIT_TOKEN or Supabase session
  // Optionally restrict to specific users by uncommenting and configuring:
  // const auth = await authenticateRequest(request, {
  //   allowedEmails: ["user@example.com"], // Only allow these emails
  //   // OR
  //   // allowedUserIds: ["user-id-here"], // Only allow these user IDs
  // });
  const auth = await authenticateRequest(request);

  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
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

  const payload = json as Record<string, unknown>;

  // Check if user-input mode is used
  const userInput = typeof payload.userInput === "string" ? payload.userInput.trim() : undefined;

  let title: string;
  let description: string;
  let tags: string[];
  let userComment: string | undefined;
  let servings: number | undefined;
  let cuisine: string | undefined;

  if (userInput) {
    // Parse user input to extract structured data
    try {
      const parsedData = await parseUserInput(userInput, apiKey);
      title = parsedData.title;
      description = parsedData.description;
      tags = parsedData.tags;
      userComment = parsedData.userComment;
      servings = parsedData.servings;
      cuisine = parsedData.cuisine;
    } catch (error) {
      console.error("Failed to parse user input:", error);
      return NextResponse.json(
        { error: `Failed to parse user input: ${(error as Error).message}` },
        { status: 400 },
      );
    }
  } else {
    // Legacy structured data mode
    if (!("title" in payload) || !("description" in payload) || !("tags" in payload)) {
      return NextResponse.json(
        { error: "Payload must include either 'userInput' or 'title', 'description', and 'tags'." },
        { status: 400 },
      );
    }

    title = typeof payload.title === "string" ? payload.title.trim() : "";
    description = typeof payload.description === "string" ? payload.description.trim() : "";
    const tagsInput = Array.isArray(payload.tags) ? payload.tags : [];
    tags = tagsInput
      .map((tag) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
      .filter(Boolean);

    if (!title || !description || tags.length === 0) {
      return NextResponse.json(
        { error: "Title, description, and at least one tag are required." },
        { status: 400 },
      );
    }

    userComment = typeof payload.userComment === "string" ? payload.userComment.trim() : undefined;
    servings =
      typeof payload.servings === "number" && Number.isFinite(payload.servings)
        ? payload.servings
        : undefined;
    cuisine = typeof payload.cuisine === "string" ? payload.cuisine.trim() : undefined;
  }

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

async function parseUserInput(
  userInput: string,
  apiKey: string,
): Promise<{
  title: string;
  description: string;
  tags: string[];
  userComment?: string;
  servings?: number;
  cuisine?: string;
}> {
  const parsePrompt = `Parse the following user input about a recipe request and extract structured information.

User input: "${userInput}"

Extract and return a JSON object with the following structure:
{
  "title": "A clear, concise recipe title",
  "description": "A short, savoury description of the meal that captures its essence and appeal",
  "tags": ["array", "of", "relevant", "tags"],
  "userComment": "optional additional notes or requirements from the user",
  "servings": optional number,
  "cuisine": "optional cuisine type if mentioned"
}

Guidelines:
- The title should be a clear recipe name (e.g., "Thai Chicken Curry", "Vegetarian Pasta Primavera")
- The description must be a short, savoury description that makes the meal sound appealing and appetizing (1-2 sentences). Focus on the flavours, textures, and overall appeal of the dish.
- Tags MUST always include:
  * Main protein type: one of "seafood", "pork", "beef", "chicken", "vegetarian", or "vegan" (based on the dish, infer from ingredients even if not explicitly stated) - this is the ONLY ingredient-related tag allowed
  * Include "glutenfree" or "gluten-free" if the dish is naturally gluten-free or if explicitly mentioned
  * Country or region of origin: infer the cuisine style and add appropriate tags like "italian", "mediterranean", "thai", "indian", "mexican", "chinese", "japanese", "french", etc. (even if not explicitly mentioned, infer from dish characteristics)
- Additional tags: include any other relevant tags mentioned (spicy, dairy, legumes, tofu, plant-based, etc.) but DO NOT include individual ingredient names like "garlic", "onion", "tomato", "cheese", "herbs", etc.
- DO NOT include usecase or situational tags like "comfort food", "weeknight dinner", "party food", "quick meal", "family-friendly", etc. - only include dietary preferences, cuisine styles, and dish characteristics
- Include any specific requirements or preferences in userComment
- Extract servings and cuisine only if explicitly mentioned
- IMPORTANT: Always generate tags even if the user didn't explicitly mention them - infer them from the dish description and ingredients
- Return only valid JSON, no additional text`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: parsePrompt,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          tags: {
            type: "array",
            items: { type: "string" },
          },
          userComment: { type: "string" },
          servings: { type: "integer" },
          cuisine: { type: "string" },
        },
        required: ["title", "description", "tags"],
      },
      temperature: 0.3,
    },
  };

  const response = await callGemini(TEXT_MODEL, requestBody, apiKey);
  const jsonText = ensureText(response, "User input parsing");

  try {
    const parsed = JSON.parse(jsonText) as {
      title: string;
      description: string;
      tags: string[];
      userComment?: string;
      servings?: number;
      cuisine?: string;
    };

    // Normalize tags
    parsed.tags = parsed.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);

    if (!parsed.title || !parsed.description || parsed.tags.length === 0) {
      throw new Error("Parsed data missing required fields");
    }

    return parsed;
  } catch (error) {
    throw new Error(
      `Failed to parse user input JSON: ${(error as Error).message}\nRaw output:\n${jsonText}`,
    );
  }
}

async function generateRecipe(options: GenerateRequest, apiKey: string): Promise<RecipeData> {
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
