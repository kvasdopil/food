import { NextResponse, type NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdminClient";
import { authenticateRequest } from "@/lib/api-auth";
import { logApiEndpoint } from "@/lib/analytics";

/**
 * GET /api/recipes/[slug]/like
 * Get like status for a recipe (requires authentication)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Authenticate the request - requires user session (not EDIT_TOKEN)
  const auth = await authenticateRequest(request);
  if (!auth.authorized || !auth.userId) {
    logApiEndpoint({
      endpoint: `/api/recipes/${slug}/like`,
      method: "GET",
      statusCode: 401,
      isProtected: true,
    });
    return NextResponse.json(
      { error: auth.authorized === false ? auth.error : "Authentication required" },
      { status: 401 },
    );
  }

  if (!supabaseAdmin) {
    logApiEndpoint({
      endpoint: `/api/recipes/${slug}/like`,
      method: "GET",
      statusCode: 500,
      isProtected: true,
    });
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    // Check if recipe exists
    const { data: recipe, error: recipeError } = await supabaseAdmin
      .from("recipes")
      .select("slug")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();

    if (recipeError) {
      console.error("Failed to check recipe existence:", recipeError);
      logApiEndpoint({
        endpoint: `/api/recipes/${slug}/like`,
        method: "GET",
        statusCode: 500,
        isProtected: true,
      });
      return NextResponse.json({ error: "Failed to check recipe" }, { status: 500 });
    }

    if (!recipe) {
      logApiEndpoint({
        endpoint: `/api/recipes/${slug}/like`,
        method: "GET",
        statusCode: 404,
        isProtected: true,
      });
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    // Check if user has liked this recipe
    // Note: We use supabaseAdmin but rely on RLS to ensure user can only see their own likes
    // We need to set the user context for RLS to work
    const { data: like, error: likeError } = await supabaseAdmin
      .from("recipe_likes")
      .select("id")
      .eq("user_id", auth.userId)
      .eq("recipe_slug", slug)
      .limit(1)
      .maybeSingle();

    if (likeError) {
      console.error("Failed to check like status:", likeError);
      logApiEndpoint({
        endpoint: `/api/recipes/${slug}/like`,
        method: "GET",
        statusCode: 500,
        isProtected: true,
      });
      return NextResponse.json({ error: "Failed to check like status" }, { status: 500 });
    }

    const liked = !!like;

    logApiEndpoint({
      endpoint: `/api/recipes/${slug}/like`,
      method: "GET",
      statusCode: 200,
      userId: auth.userId,
      userEmail: auth.userEmail,
      isProtected: true,
    });

    return NextResponse.json({
      liked,
      slug,
    });
  } catch (error) {
    console.error("Like status check failure:", error);
    logApiEndpoint({
      endpoint: `/api/recipes/${slug}/like`,
      method: "GET",
      statusCode: 500,
      isProtected: true,
    });
    return NextResponse.json({ error: "Failed to check like status" }, { status: 500 });
  }
}

/**
 * POST /api/recipes/[slug]/like
 * Toggle like status for a recipe (requires authentication)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Authenticate the request - requires user session (not EDIT_TOKEN)
  const auth = await authenticateRequest(request);
  if (!auth.authorized || !auth.userId) {
    logApiEndpoint({
      endpoint: `/api/recipes/${slug}/like`,
      method: "POST",
      statusCode: 401,
      isProtected: true,
    });
    return NextResponse.json(
      { error: auth.authorized === false ? auth.error : "Authentication required" },
      { status: 401 },
    );
  }

  if (!supabaseAdmin) {
    logApiEndpoint({
      endpoint: `/api/recipes/${slug}/like`,
      method: "POST",
      statusCode: 500,
      isProtected: true,
    });
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    // Check if recipe exists
    const { data: recipe, error: recipeError } = await supabaseAdmin
      .from("recipes")
      .select("slug")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();

    if (recipeError) {
      console.error("Failed to check recipe existence:", recipeError);
      logApiEndpoint({
        endpoint: `/api/recipes/${slug}/like`,
        method: "POST",
        statusCode: 500,
        isProtected: true,
      });
      return NextResponse.json({ error: "Failed to check recipe" }, { status: 500 });
    }

    if (!recipe) {
      logApiEndpoint({
        endpoint: `/api/recipes/${slug}/like`,
        method: "POST",
        statusCode: 404,
        isProtected: true,
      });
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    // Check current like status
    const { data: existingLike, error: checkError } = await supabaseAdmin
      .from("recipe_likes")
      .select("id")
      .eq("user_id", auth.userId)
      .eq("recipe_slug", slug)
      .limit(1)
      .maybeSingle();

    if (checkError) {
      console.error("Failed to check existing like:", checkError);
      logApiEndpoint({
        endpoint: `/api/recipes/${slug}/like`,
        method: "POST",
        statusCode: 500,
        isProtected: true,
      });
      return NextResponse.json({ error: "Failed to check like status" }, { status: 500 });
    }

    let liked: boolean;

    if (existingLike) {
      // Unlike: delete the like
      const { error: deleteError } = await supabaseAdmin
        .from("recipe_likes")
        .delete()
        .eq("user_id", auth.userId)
        .eq("recipe_slug", slug);

      if (deleteError) {
        console.error("Failed to unlike recipe:", deleteError);
        logApiEndpoint({
          endpoint: `/api/recipes/${slug}/like`,
          method: "POST",
          statusCode: 500,
          isProtected: true,
        });
        return NextResponse.json({ error: "Failed to unlike recipe" }, { status: 500 });
      }

      liked = false;
    } else {
      // Like: insert the like
      const { error: insertError } = await supabaseAdmin.from("recipe_likes").insert({
        user_id: auth.userId,
        recipe_slug: slug,
      });

      if (insertError) {
        console.error("Failed to like recipe:", insertError);
        logApiEndpoint({
          endpoint: `/api/recipes/${slug}/like`,
          method: "POST",
          statusCode: 500,
          isProtected: true,
        });
        return NextResponse.json({ error: "Failed to like recipe" }, { status: 500 });
      }

      liked = true;
    }

    logApiEndpoint({
      endpoint: `/api/recipes/${slug}/like`,
      method: "POST",
      statusCode: 200,
      userId: auth.userId,
      userEmail: auth.userEmail,
      isProtected: true,
    });

    return NextResponse.json({
      liked,
      slug,
    });
  } catch (error) {
    console.error("Like toggle failure:", error);
    logApiEndpoint({
      endpoint: `/api/recipes/${slug}/like`,
      method: "POST",
      statusCode: 500,
      isProtected: true,
    });
    return NextResponse.json({ error: "Failed to toggle like" }, { status: 500 });
  }
}
