import { NextResponse, type NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdminClient";
import { supabase } from "@/lib/supabaseClient";
import { parseTagsFromQuery } from "@/lib/tag-utils";
import { seededShuffle, getDateSeed } from "@/lib/shuffle-utils";
import { logApiEndpoint } from "@/lib/analytics";
import { authenticateRequest } from "@/lib/api-auth";
import { buildInstructions } from "@/lib/recipe-utils";

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
  imageUrl?: string | null | undefined; // undefined = not provided, null = explicitly cleared
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
};

type RecipeListItem = {
  slug: string;
  name: string;
  description: string | null;
  tags: string[];
  image_url: string | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
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
      typeof entry.step === "number" && Number.isFinite(entry.step)
        ? Math.max(1, Math.trunc(entry.step))
        : undefined;
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
    typeof payload.slug === "string" && payload.slug.trim()
      ? slugify(payload.slug.trim())
      : undefined;

  const imageUrl =
    typeof payload.imageUrl === "string"
      ? payload.imageUrl.trim()
      : typeof payload.image_url === "string"
        ? payload.image_url.trim()
        : payload.imageUrl === null || payload.image_url === null
          ? null
          : undefined; // undefined means not provided, null means explicitly cleared

  const prepTimeMinutes =
    typeof payload.prepTimeMinutes === "number" && Number.isFinite(payload.prepTimeMinutes)
      ? Math.max(0, Math.trunc(payload.prepTimeMinutes))
      : payload.prepTimeMinutes === null
        ? null
        : undefined;

  const cookTimeMinutes =
    typeof payload.cookTimeMinutes === "number" && Number.isFinite(payload.cookTimeMinutes)
      ? Math.max(0, Math.trunc(payload.cookTimeMinutes))
      : payload.cookTimeMinutes === null
        ? null
        : undefined;

  return {
    slug: slugFromPayload,
    title,
    summary,
    ingredients,
    instructions,
    tags,
    imageUrl,
    prepTimeMinutes,
    cookTimeMinutes,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const pageParam = searchParams.get("page");
  const fromSlug = searchParams.get("from");
  const tagsParam = searchParams.get("tags");
  const searchQuery = searchParams.get("q") || searchParams.get("search") || "";
  const favoritesParam = searchParams.get("favorites");
  const showFavorites = favoritesParam === "true";
  const filterTags = parseTagsFromQuery(tagsParam);

  // If favorites filter is requested, authenticate the user
  let userId: string | undefined;
  if (showFavorites) {
    const auth = await authenticateRequest(request);
    if (!auth.authorized || !auth.userId) {
      logApiEndpoint({
        endpoint: "/api/recipes",
        method: "GET",
        statusCode: 401,
        isProtected: true,
      });
      return NextResponse.json(
        { error: auth.authorized === false ? auth.error : "Authentication required for favorites filter" },
        { status: 401 },
      );
    }
    userId = auth.userId;
  }

  if (!supabase) {
    logApiEndpoint({
      endpoint: "/api/recipes",
      method: "GET",
      statusCode: 500,
      isProtected: showFavorites,
    });
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    // Build base query for counting total (with tag filters if present)
    let countQuery = supabase.from("recipes").select("*", { count: "exact", head: true });

    // Apply tag filters - recipes must contain ALL specified tags
    if (filterTags.length > 0) {
      // Filter for recipes where tags array contains all requested tags
      // Postgres array contains: use cs (contains) operator for each tag
      for (const tag of filterTags) {
        countQuery = countQuery.contains("tags", [tag]);
      }
    }

    const { error: countError } = await countQuery;

    if (countError) {
      throw countError;
    }

    // Fetch all matching recipes (with a reasonable limit to prevent memory issues)
    // In production, you might want to set a max limit like 10,000 recipes
    const MAX_RECIPES_TO_FETCH = 10000;

    let allRecipesQuery = supabase
      .from("recipes")
      .select("slug, name, description, tags, image_url, prep_time_minutes, cook_time_minutes")
      .order("created_at", { ascending: false })
      .order("slug", { ascending: true })
      .limit(MAX_RECIPES_TO_FETCH);

    // Apply tag filters
    if (filterTags.length > 0) {
      for (const tag of filterTags) {
        allRecipesQuery = allRecipesQuery.contains("tags", [tag]);
      }
    }

    const { data: allRecipesData, error: allRecipesError } = await allRecipesQuery;

    if (allRecipesError) {
      throw allRecipesError;
    }

    let allRecipes = allRecipesData || [];

    // Apply favorites filter if requested
    if (showFavorites && userId && supabaseAdmin) {
      try {
        // Get all liked recipe slugs for the user
        const { data: likes, error: likesError } = await supabaseAdmin
          .from("recipe_likes")
          .select("recipe_slug")
          .eq("user_id", userId);

        if (likesError) {
          console.error("Failed to fetch user likes:", likesError);
          throw likesError;
        }

        const likedSlugs = new Set((likes || []).map((like) => like.recipe_slug as string));

        // Filter recipes to only include liked ones
        allRecipes = allRecipes.filter((recipe) => likedSlugs.has(recipe.slug));
      } catch (error) {
        console.error("Error applying favorites filter:", error);
        logApiEndpoint({
          endpoint: "/api/recipes",
          method: "GET",
          statusCode: 500,
          isProtected: true,
        });
        return NextResponse.json(
          { error: "Failed to apply favorites filter" },
          { status: 500 },
        );
      }
    }

    // Apply search filter if search query is provided
    if (searchQuery.trim()) {
      const searchTerm = searchQuery.trim().toLowerCase();
      allRecipes = allRecipes.filter((recipe) => {
        // Search in recipe name (case-insensitive partial match)
        const nameMatch = recipe.name?.toLowerCase().includes(searchTerm);

        // Search in tags (case-insensitive partial match)
        const tagMatch = recipe.tags?.some((tag) => tag.toLowerCase().includes(searchTerm));

        return nameMatch || tagMatch;
      });
    }

    // Shuffle all recipes deterministically based on current date
    const dateSeed = getDateSeed();
    const shuffledRecipes = seededShuffle(allRecipes, dateSeed);

    // Now handle pagination from the shuffled array
    let recipes: RecipeListItem[] = [];
    let hasMore = false;
    let currentPage = 1;

    if (fromSlug) {
      // Find the index of the recipe with the given slug in the shuffled array
      const fromIndex = shuffledRecipes.findIndex((r) => r.slug === fromSlug);

      if (fromIndex === -1) {
        // Slug not found, return first page
        recipes = shuffledRecipes.slice(0, ITEMS_PER_PAGE);
        hasMore = shuffledRecipes.length > ITEMS_PER_PAGE;
        currentPage = 1;
      } else {
        // Get recipes after the found slug
        const startIndex = fromIndex + 1;
        recipes = shuffledRecipes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
        hasMore = startIndex + ITEMS_PER_PAGE < shuffledRecipes.length;
        currentPage = Math.floor(fromIndex / ITEMS_PER_PAGE) + 1;
      }
    } else {
      // Traditional page-based pagination
      const page = pageParam ? parseInt(pageParam, 10) : 1;

      if (page < 1) {
        return NextResponse.json({ error: "Page must be 1 or greater" }, { status: 400 });
      }

      const offset = (page - 1) * ITEMS_PER_PAGE;
      recipes = shuffledRecipes.slice(offset, offset + ITEMS_PER_PAGE);
      currentPage = page;
      hasMore = offset + ITEMS_PER_PAGE < shuffledRecipes.length;
    }

    const totalPages = Math.ceil(shuffledRecipes.length / ITEMS_PER_PAGE);

    logApiEndpoint({
      endpoint: "/api/recipes",
      method: "GET",
      statusCode: 200,
      isProtected: showFavorites,
      userId: showFavorites ? userId : undefined,
    });
    return NextResponse.json({
      recipes: recipes || [],
      pagination: {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        total: shuffledRecipes.length,
        totalPages,
        hasMore,
      },
    });
  } catch (error) {
    console.error("Recipes API failure:", error);
    logApiEndpoint({
      endpoint: "/api/recipes",
      method: "GET",
      statusCode: 500,
      isProtected: false,
    });
    return NextResponse.json({ error: "Failed to fetch recipes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Authenticate the request - allows either EDIT_TOKEN or Supabase session
  const auth = await authenticateRequest(request);

  if (!auth.authorized) {
    logApiEndpoint({
      endpoint: "/api/recipes",
      method: "POST",
      statusCode: 401,
      isProtected: true,
    });
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
  }

  // Log endpoint usage
  logApiEndpoint({
    endpoint: "/api/recipes",
    method: "POST",
    userId: auth.userId,
    userEmail: auth.userEmail,
    isProtected: true,
  });

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
    return NextResponse.json(
      { error: "Payload must include title, ingredients, instructions, and tags." },
      { status: 400 },
    );
  }

  const slug = payload.slug ?? slugify(payload.title);
  if (!slug) {
    return NextResponse.json({ error: "Unable to derive slug from title." }, { status: 400 });
  }

  // Check if recipe exists to preserve image_url if not provided
  const { data: existingRecipe } = await supabaseAdmin
    .from("recipes")
    .select("image_url")
    .eq("slug", slug)
    .maybeSingle();

  const dbPayload: {
    slug: string;
    name: string;
    description: string | null;
    ingredients: string;
    instructions: string;
    image_url?: string | null;
    tags: string[];
    prep_time_minutes?: number | null;
    cook_time_minutes?: number | null;
  } = {
    slug,
    name: payload.title,
    description: payload.summary ?? null,
    ingredients: JSON.stringify(payload.ingredients),
    instructions: buildInstructions(payload.instructions),
    tags: payload.tags,
  };

  // Include time fields if provided
  if (payload.prepTimeMinutes !== undefined) {
    dbPayload.prep_time_minutes = payload.prepTimeMinutes;
  }
  if (payload.cookTimeMinutes !== undefined) {
    dbPayload.cook_time_minutes = payload.cookTimeMinutes;
  }

  // Only include image_url if explicitly provided, otherwise preserve existing
  if (payload.imageUrl !== undefined) {
    dbPayload.image_url = payload.imageUrl ?? null;
  } else if (existingRecipe?.image_url) {
    // Preserve existing image_url if not provided in payload
    dbPayload.image_url = existingRecipe.image_url;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("recipes")
      .upsert(dbPayload, { onConflict: "slug" })
      .select("id, slug, name, description, tags, image_url, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    logApiEndpoint({
      endpoint: "/api/recipes",
      method: "POST",
      userId: auth.authorized ? auth.userId : undefined,
      userEmail: auth.authorized ? auth.userEmail : undefined,
      statusCode: 201,
      isProtected: true,
    });
    return NextResponse.json({ recipe: data }, { status: 201 });
  } catch (error) {
    console.error("Failed to upsert recipe:", error);
    logApiEndpoint({
      endpoint: "/api/recipes",
      method: "POST",
      userId: auth.authorized ? auth.userId : undefined,
      userEmail: auth.authorized ? auth.userEmail : undefined,
      statusCode: 500,
      isProtected: true,
    });
    return NextResponse.json({ error: "Failed to save recipe" }, { status: 500 });
  }
}
