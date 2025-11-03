import { NextResponse, type NextRequest } from "next/server";
import { callGemini, ensureText, TEXT_MODEL } from "@/lib/gemini";
import {
  buildRecipeGenerationPrompt,
  recipeSchema,
  type GenerateRequest,
} from "@/lib/prompts/recipe-generation";
import { evaluateRecipe } from "@/lib/recipe-refinement";
import { type RecipeData, normalizeRecipe, isEvaluationPassed } from "@/lib/recipe-utils";
import { supabaseAdmin } from "@/lib/supabaseAdminClient";
import { logApiEndpoint } from "@/lib/analytics";
import { authenticateRequest } from "@/lib/api-auth";

type IngredientPayload = {
  name: string;
  amount: string;
  notes?: string;
};

type InstructionPayload = {
  step?: number;
  action: string;
};

function parseIngredients(raw: string): IngredientPayload[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          name: String(item.name ?? "").trim(),
          amount: String(item.amount ?? "").trim(),
          notes: item.notes ? String(item.notes).trim() : undefined,
        }))
        .filter((item) => item.name.length > 0);
    }
  } catch {
    // fallback - try to parse as string format
  }
  return [];
}

function parseInstructions(raw: string): InstructionPayload[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((step, index) => {
      // Remove leading number if present (e.g., "1. Action" -> "Action")
      const action = step.replace(/^\d+\.\s*/, "").trim();
      return {
        step: index + 1,
        action,
      };
    });
}

function buildInstructions(instructions: InstructionPayload[]) {
  return instructions
    .map((entry, index) => {
      const stepNumber = entry.step ?? index + 1;
      return `${stepNumber}. ${entry.action}`;
    })
    .join("\n");
}

async function generateRefinedRecipe(
  existingRecipe: RecipeData,
  apiKey: string,
  feedback: string,
): Promise<RecipeData> {
  const generateOptions: GenerateRequest = {
    title: existingRecipe.title,
    description: existingRecipe.summary || "",
    tags: existingRecipe.tags || [],
  };

  const prompt = buildRecipeGenerationPrompt(generateOptions, feedback);

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
  const jsonText = ensureText(response, "Recipe refinement");

  try {
    const refined = JSON.parse(jsonText) as RecipeData;
    refined.title = existingRecipe.title;
    refined.summary = existingRecipe.summary;
    refined.tags = existingRecipe.tags || [];
    return normalizeRecipe(refined);
  } catch (error) {
    throw new Error(
      `Failed to parse refined recipe JSON: ${(error as Error).message}\nRaw output:\n${jsonText}`,
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const editToken = process.env.EDIT_TOKEN;
  if (!editToken) {
    console.error("POST /api/recipes/[slug]/refine missing EDIT_TOKEN environment variable.");
    return NextResponse.json({ error: "Server is not configured for edits" }, { status: 500 });
  }

  // Try to authenticate to get user info if available
  const auth = await authenticateRequest(request, { requireAuth: false });
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const tokenMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  const providedToken = tokenMatch ? tokenMatch[1].trim() : null;

  if (!providedToken || providedToken !== editToken) {
    logApiEndpoint({
      endpoint: `/api/recipes/${slug}/refine`,
      method: "POST",
      statusCode: 401,
      isProtected: true,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Log endpoint usage
  logApiEndpoint({
    endpoint: `/api/recipes/${slug}/refine`,
    method: "POST",
    userId: auth.authorized ? auth.userId : undefined,
    userEmail: auth.authorized ? auth.userEmail : undefined,
    isProtected: true,
  });

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("POST /api/recipes/[slug]/refine missing GEMINI_API_KEY or GOOGLE_API_KEY.");
    return NextResponse.json(
      { error: "Server is not configured for recipe refinement" },
      { status: 500 },
    );
  }

  if (!supabaseAdmin) {
    console.error("Supabase admin client is not configured.");
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    // Fetch recipe from database
    const { data: dbRecipe, error: fetchError } = await supabaseAdmin
      .from("recipes")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (fetchError) {
      console.error("Failed to fetch recipe:", fetchError);
      return NextResponse.json({ error: "Failed to fetch recipe" }, { status: 500 });
    }

    if (!dbRecipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    // Parse ingredients and instructions from database
    const ingredients = parseIngredients(dbRecipe.ingredients);
    if (ingredients.length === 0) {
      return NextResponse.json({ error: "Recipe has no valid ingredients" }, { status: 400 });
    }

    const instructions = parseInstructions(dbRecipe.instructions);
    if (instructions.length === 0) {
      return NextResponse.json({ error: "Recipe has no valid instructions" }, { status: 400 });
    }

    // Convert database format to RecipeData
    const recipe: RecipeData = {
      title: dbRecipe.name,
      summary: dbRecipe.description || undefined,
      ingredients: ingredients.map((ing) => ({
        name: ing.name,
        amount: ing.amount,
        notes: ing.notes,
      })),
      instructions: instructions.map((inst) => ({
        step: inst.step || 1,
        action: inst.action,
      })),
      tags: dbRecipe.tags || [],
    };

    // Evaluate the recipe
    const evaluationResult = await evaluateRecipe(recipe, apiKey);

    // Check if all checks passed
    if (isEvaluationPassed(evaluationResult)) {
      return NextResponse.json(
        { message: "Recipe passed all checks. No changes needed.", recipe },
        { status: 200 },
      );
    }

    // Generate refined version with feedback
    const refinedRecipe = await generateRefinedRecipe(recipe, apiKey, evaluationResult);

    // Update recipe in database
    const dbPayload = {
      name: refinedRecipe.title,
      description: refinedRecipe.summary ?? null,
      ingredients: JSON.stringify(refinedRecipe.ingredients),
      instructions: buildInstructions(refinedRecipe.instructions),
      tags: refinedRecipe.tags ?? [],
    };

    const { data: updatedRecipe, error: updateError } = await supabaseAdmin
      .from("recipes")
      .upsert(
        {
          slug,
          ...dbPayload,
        },
        { onConflict: "slug" },
      )
      .select("id, slug, name, description, tags, image_url, created_at, updated_at")
      .single();

    if (updateError) {
      console.error("Failed to update recipe:", updateError);
      return NextResponse.json({ error: "Failed to update recipe" }, { status: 500 });
    }

    logApiEndpoint({
      endpoint: `/api/recipes/${slug}/refine`,
      method: "POST",
      userId: auth.authorized ? auth.userId : undefined,
      userEmail: auth.authorized ? auth.userEmail : undefined,
      statusCode: 200,
      isProtected: true,
    });
    return NextResponse.json(
      {
        message: "Recipe refined and updated successfully",
        evaluation: evaluationResult,
        recipe: updatedRecipe,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to refine recipe:", error);
    logApiEndpoint({
      endpoint: `/api/recipes/${slug}/refine`,
      method: "POST",
      userId: auth.authorized ? auth.userId : undefined,
      userEmail: auth.authorized ? auth.userEmail : undefined,
      statusCode: 500,
      isProtected: true,
    });
    return NextResponse.json(
      { error: `Failed to refine recipe: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}
