import { NextResponse, type NextRequest } from "next/server";
import { callGemini, ensureText, TEXT_MODEL } from "@/lib/gemini";
import {
  buildRecipeGenerationPrompt,
  recipeSchema,
  type GenerateRequest,
} from "@/lib/prompts/recipe-generation";
import {
  buildUserInputParsingPrompt,
  userInputParsingSchema,
  type ParsedUserInput,
} from "@/lib/prompts/user-input-parsing";
import { type RecipeData, normalizeRecipe, slugify } from "@/lib/recipe-utils";
import { authenticateRequest } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const endpointStartTime = Date.now();
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
      const parseStartTime = Date.now();
      const parsedData = await parseUserInput(userInput);
      const parseDuration = Date.now() - parseStartTime;
      console.log(`[LLM] User input parsing completed in ${parseDuration}ms`, {
        operation: "parseUserInput",
        durationMs: parseDuration,
        userInputLength: userInput.length,
      });
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
    const recipeGenerationStartTime = Date.now();
    const generateOptions: GenerateRequest = {
      title,
      description,
      tags,
      userComment,
      servings,
      cuisine,
    };

    // Generate recipe (first variant only)
    const generationStartTime = Date.now();
    let recipe = await generateRecipe(generateOptions);
    const generationDuration = Date.now() - generationStartTime;
    console.log(`[LLM] Recipe generation completed in ${generationDuration}ms`, {
      operation: "generateRecipe",
      durationMs: generationDuration,
      title,
      tags,
    });
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

    const recipeGenerationDuration = Date.now() - recipeGenerationStartTime;
    console.log(
      `[Recipe Generation] Total recipe generation completed in ${recipeGenerationDuration}ms`,
      {
        operation: "generateRecipeEndpoint",
        durationMs: recipeGenerationDuration,
        title,
        slug,
      },
    );

    const totalEndpointDuration = Date.now() - endpointStartTime;
    console.log(`[API] POST /api/recipes/generate completed in ${totalEndpointDuration}ms`, {
      operation: "generateRecipeEndpoint",
      totalDurationMs: totalEndpointDuration,
      title,
      slug,
    });

    return NextResponse.json({ recipe: recipeResponse }, { status: 200 });
  } catch (error) {
    console.error("Failed to generate recipe:", error);
    return NextResponse.json(
      { error: `Failed to generate recipe: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}

async function parseUserInput(userInput: string): Promise<ParsedUserInput> {
  const parsePrompt = buildUserInputParsingPrompt(userInput);

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
      responseSchema: userInputParsingSchema,
      temperature: 0.3,
    },
  };

  const llmStartTime = Date.now();
  console.log(`[LLM] Starting user input parsing`, {
    operation: "callGemini",
    model: TEXT_MODEL,
    promptLength: parsePrompt.length,
    userInputLength: userInput.length,
  });
  const response = await callGemini(TEXT_MODEL, requestBody);
  const llmDuration = Date.now() - llmStartTime;
  console.log(`[LLM] Gemini API call completed in ${llmDuration}ms`, {
    operation: "callGemini",
    model: TEXT_MODEL,
    durationMs: llmDuration,
    context: "parseUserInput",
  });
  const jsonText = ensureText(response, "User input parsing");

  try {
    const parsed = JSON.parse(jsonText) as ParsedUserInput;

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

async function generateRecipe(options: GenerateRequest): Promise<RecipeData> {
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

  const llmStartTime = Date.now();
  console.log(`[LLM] Starting recipe generation`, {
    operation: "callGemini",
    model: TEXT_MODEL,
    promptLength: prompt.length,
    title: options.title,
  });
  const response = await callGemini(TEXT_MODEL, requestBody);
  const llmDuration = Date.now() - llmStartTime;
  console.log(`[LLM] Gemini API call completed in ${llmDuration}ms`, {
    operation: "callGemini",
    model: TEXT_MODEL,
    durationMs: llmDuration,
    context: "generateRecipe",
  });
  const jsonText = ensureText(response, "Recipe generation");

  try {
    return JSON.parse(jsonText) as RecipeData;
  } catch (error) {
    throw new Error(
      `Failed to parse recipe JSON: ${(error as Error).message}\nRaw output:\n${jsonText}`,
    );
  }
}
