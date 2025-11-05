import { NextResponse, type NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdminClient";
import { authenticateRequest } from "@/lib/api-auth";
import { logApiEndpoint } from "@/lib/analytics";

/**
 * GET /api/recipes/likes
 * Get all liked recipe slugs for the current user (requires authentication)
 */
export async function GET(request: NextRequest) {
  // Authenticate the request - requires user session (not EDIT_TOKEN)
  const auth = await authenticateRequest(request);
  if (!auth.authorized || !auth.userId) {
    logApiEndpoint({
      endpoint: "/api/recipes/likes",
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
      endpoint: "/api/recipes/likes",
      method: "GET",
      statusCode: 500,
      isProtected: true,
    });
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    // Get all likes for the current user
    // Note: We use supabaseAdmin but rely on RLS to ensure user can only see their own likes
    const { data: likes, error } = await supabaseAdmin
      .from("recipe_likes")
      .select("recipe_slug")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch likes:", error);
      logApiEndpoint({
        endpoint: "/api/recipes/likes",
        method: "GET",
        statusCode: 500,
        isProtected: true,
      });
      return NextResponse.json({ error: "Failed to fetch likes" }, { status: 500 });
    }

    // Extract just the slugs
    const slugs = (likes || []).map((like) => like.recipe_slug as string);

    logApiEndpoint({
      endpoint: "/api/recipes/likes",
      method: "GET",
      statusCode: 200,
      userId: auth.userId,
      userEmail: auth.userEmail,
      isProtected: true,
    });

    return NextResponse.json({
      likes: slugs,
    });
  } catch (error) {
    console.error("Likes fetch failure:", error);
    logApiEndpoint({
      endpoint: "/api/recipes/likes",
      method: "GET",
      statusCode: 500,
      isProtected: true,
    });
    return NextResponse.json({ error: "Failed to fetch likes" }, { status: 500 });
  }
}
