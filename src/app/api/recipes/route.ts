import { NextResponse, type NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdminClient";
import { supabase } from "@/lib/supabaseClient";

const ITEMS_PER_PAGE = 20;

type IngredientPayload = {
  name: string;
  amount: string;
  notes?: string;
};

type InstructionPayload = {
  step?: number;
  action: string;
};

type RecipePayload = {
  slug?: string;
  title: string;
  summary?: string;
  ingredients: IngredientPayload[];
  instructions: InstructionPayload[];
  tags: string[];
  imageUrl?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeRecipePayload(payload: unknown): RecipePayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  if (!title) {
    return null;
  }

  const summary =
    typeof payload.summary === "string"
      ? payload.summary.trim()
      : typeof payload.description === "string"
        ? payload.description.trim()
        : undefined;

  const ingredientsInput = Array.isArray(payload.ingredients) ? payload.ingredients : null;
  if (!ingredientsInput || ingredientsInput.length === 0) {
    return null;
  }

  const ingredients: IngredientPayload[] = [];

  for (const entry of ingredientsInput) {
    if (!isRecord(entry)) {
      return null;
    }
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const amount = typeof entry.amount === "string" ? entry.amount.trim() : "";
    if (!name || !amount) {
      return null;
    }
    const notes = typeof entry.notes === "string" ? entry.notes.trim() : undefined;
    ingredients.push({ name, amount, ...(notes ? { notes } : {}) });
  }

  const instructionsInput = Array.isArray(payload.instructions) ? payload.instructions : null;
  if (!instructionsInput || instructionsInput.length === 0) {
    return null;
  }

  const instructions: InstructionPayload[] = [];

  for (const entry of instructionsInput) {
    if (!isRecord(entry)) {
      return null;
    }
    const action = typeof entry.action === "string" ? entry.action.trim() : "";
    if (!action) {
      return null;
    }
    const stepValue =
      typeof entry.step === "number" && Number.isFinite(entry.step) ? Math.max(1, Math.trunc(entry.step)) : undefined;
    instructions.push(stepValue ? { step: stepValue, action } : { action });
  }

  const tagsInput = Array.isArray(payload.tags) ? payload.tags : null;
  const tags: string[] = [];
  if (tagsInput) {
    for (const tag of tagsInput) {
      if (typeof tag === "string" && tag.trim()) {
        tags.push(tag.trim().toLowerCase());
      }
    }
  }

  if (tags.length === 0) {
    return null;
  }

  const slugFromPayload =
    typeof payload.slug === "string" && payload.slug.trim() ? slugify(payload.slug.trim()) : undefined;

  const imageUrl =
    typeof payload.imageUrl === "string"
      ? payload.imageUrl.trim()
      : typeof payload.image_url === "string"
        ? payload.image_url.trim()
        : null;

  return { slug: slugFromPayload, title, summary, ingredients, instructions, tags, imageUrl };
}

function buildInstructions(instructions: InstructionPayload[]) {
  return instructions
    .map((entry, index) => {
      const stepNumber = entry.step ?? index + 1;
      return `${stepNumber}. ${entry.action}`;
    })
    .join("\n");
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const pageParam = searchParams.get("page");
  const page = pageParam ? parseInt(pageParam, 10) : 1;

  if (page < 1) {
    return NextResponse.json({ error: "Page must be 1 or greater" }, { status: 400 });
  }

  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    // Get total count
    const { count, error: countError } = await supabase
      .from("recipes")
      .select("*", { count: "exact", head: true });

    if (countError) {
      throw countError;
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
    const offset = (page - 1) * ITEMS_PER_PAGE;

    // Get paginated recipes
    const { data: recipes, error: recipesError } = await supabase
      .from("recipes")
      .select("slug, name, description, tags, image_url")
      .order("created_at", { ascending: false })
      .range(offset, offset + ITEMS_PER_PAGE - 1);

    if (recipesError) {
      throw recipesError;
    }

    const hasMore = page < totalPages;

    return NextResponse.json({
      recipes: recipes || [],
      pagination: {
        page,
        limit: ITEMS_PER_PAGE,
        total,
        totalPages,
        hasMore,
      },
    });
  } catch (error) {
    console.error("Recipes API failure:", error);
    return NextResponse.json({ error: "Failed to fetch recipes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const editToken = process.env.EDIT_TOKEN;
  if (!editToken) {
    console.error("POST /api/recipes missing EDIT_TOKEN environment variable.");
    return NextResponse.json({ error: "Server is not configured for edits" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const tokenMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  const providedToken = tokenMatch ? tokenMatch[1].trim() : null;

  if (!providedToken || providedToken !== editToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    console.error("Supabase admin client is not configured.");
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch (error) {
    console.error("Invalid JSON payload:", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = normalizeRecipePayload(json);
  if (!payload) {
    return NextResponse.json({ error: "Payload must include title, ingredients, instructions, and tags." }, { status: 400 });
  }

  const slug = payload.slug ?? slugify(payload.title);
  if (!slug) {
    return NextResponse.json({ error: "Unable to derive slug from title." }, { status: 400 });
  }
  const dbPayload = {
    slug,
    name: payload.title,
    description: payload.summary ?? null,
    ingredients: JSON.stringify(payload.ingredients),
    instructions: buildInstructions(payload.instructions),
    image_url: payload.imageUrl ?? null,
    tags: payload.tags,
  };

  try {
    const { data, error } = await supabaseAdmin
      .from("recipes")
      .upsert(dbPayload, { onConflict: "slug" })
      .select("id, slug, name, description, tags, image_url, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ recipe: data }, { status: 201 });
  } catch (error) {
    console.error("Failed to upsert recipe:", error);
    return NextResponse.json({ error: "Failed to save recipe" }, { status: 500 });
  }
}
