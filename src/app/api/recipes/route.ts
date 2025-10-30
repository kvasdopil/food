import { NextResponse, type NextRequest } from "next/server";

import { supabase } from "@/lib/supabaseClient";

const ITEMS_PER_PAGE = 20;

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
