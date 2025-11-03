import { NextResponse, type NextRequest } from "next/server";

import { supabase } from "@/lib/supabaseClient";
import { logApiEndpoint } from "@/lib/analytics";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!supabase) {
    logApiEndpoint({
      endpoint: `/api/recipes/${slug}`,
      method: "GET",
      statusCode: 500,
      isProtected: false,
    });
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Failed to load recipe:", error);
      return NextResponse.json({ error: "Failed to fetch recipe" }, { status: 500 });
    }

    if (!data) {
      logApiEndpoint({
        endpoint: `/api/recipes/${slug}`,
        method: "GET",
        statusCode: 404,
        isProtected: false,
      });
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    logApiEndpoint({
      endpoint: `/api/recipes/${slug}`,
      method: "GET",
      statusCode: 200,
      isProtected: false,
    });
    // Transform to match RecipeData type
    return NextResponse.json({
      slug: data.slug,
      name: data.name,
      description: data.description ?? "",
      ingredients: data.ingredients,
      instructions: data.instructions,
      imageUrl: data.image_url,
      tags: data.tags ?? [],
      prepTimeMinutes: data.prep_time_minutes ?? null,
      cookTimeMinutes: data.cook_time_minutes ?? null,
    });
  } catch (error) {
    console.error("Recipes API failure:", error);
    logApiEndpoint({
      endpoint: `/api/recipes/${slug}`,
      method: "GET",
      statusCode: 500,
      isProtected: false,
    });
    return NextResponse.json({ error: "Failed to fetch recipe" }, { status: 500 });
  }
}
