import { NextResponse, type NextRequest } from "next/server";

import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseAdminClient";
import { authenticateRequest } from "@/lib/api-auth";
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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Authenticate the request - allows either EDIT_TOKEN or Supabase session
  const auth = await authenticateRequest(request);
  if (!auth.authorized) {
    logApiEndpoint({
      endpoint: `/api/recipes/${slug}`,
      method: "DELETE",
      statusCode: 401,
      isProtected: true,
    });
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    logApiEndpoint({
      endpoint: `/api/recipes/${slug}`,
      method: "DELETE",
      userId: auth.userId,
      userEmail: auth.userEmail,
      statusCode: 500,
      isProtected: true,
    });
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    // First check if the recipe exists
    const { data: existingRecipe, error: fetchError } = await supabaseAdmin
      .from("recipes")
      .select("slug, name")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("Failed to check recipe existence:", fetchError);
      logApiEndpoint({
        endpoint: `/api/recipes/${slug}`,
        method: "DELETE",
        userId: auth.userId,
        userEmail: auth.userEmail,
        statusCode: 500,
        isProtected: true,
      });
      return NextResponse.json({ error: "Failed to check recipe" }, { status: 500 });
    }

    if (!existingRecipe) {
      logApiEndpoint({
        endpoint: `/api/recipes/${slug}`,
        method: "DELETE",
        userId: auth.userId,
        userEmail: auth.userEmail,
        statusCode: 404,
        isProtected: true,
      });
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    // Delete the recipe
    const { error: deleteError } = await supabaseAdmin.from("recipes").delete().eq("slug", slug);

    if (deleteError) {
      console.error("Failed to delete recipe:", deleteError);
      logApiEndpoint({
        endpoint: `/api/recipes/${slug}`,
        method: "DELETE",
        userId: auth.userId,
        userEmail: auth.userEmail,
        statusCode: 500,
        isProtected: true,
      });
      return NextResponse.json({ error: "Failed to delete recipe" }, { status: 500 });
    }

    logApiEndpoint({
      endpoint: `/api/recipes/${slug}`,
      method: "DELETE",
      userId: auth.userId,
      userEmail: auth.userEmail,
      statusCode: 200,
      isProtected: true,
    });

    return NextResponse.json({
      success: true,
      message: `Recipe "${existingRecipe.name}" (${slug}) deleted successfully`,
    });
  } catch (error) {
    console.error("Recipe deletion failure:", error);
    logApiEndpoint({
      endpoint: `/api/recipes/${slug}`,
      method: "DELETE",
      userId: auth.userId,
      userEmail: auth.userEmail,
      statusCode: 500,
      isProtected: true,
    });
    return NextResponse.json({ error: "Failed to delete recipe" }, { status: 500 });
  }
}
