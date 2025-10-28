import { NextResponse, type NextRequest } from "next/server";

import { supabase } from "@/lib/supabaseClient";

async function getRandomSlug(exclude?: string) {
  if (!supabase) {
    throw new Error("Supabase client not configured");
  }

  const maxAttempts = 5;
  let attempt = 0;

  while (attempt < maxAttempts) {
    const { data, error } = await supabase.rpc("get_random_recipe");

    if (error) {
      throw error;
    }

    const slug = data && data.length > 0 ? data[0]?.slug : null;

    if (slug && slug !== exclude) {
      return slug as string;
    }

    attempt += 1;
  }

  throw new Error("Unable to find random recipe slug");
}

export async function GET(request: NextRequest) {
  const exclude = request.nextUrl.searchParams.get("exclude") ?? undefined;

  try {
    const slug = await getRandomSlug(exclude);
    return NextResponse.json({ slug });
  } catch (error) {
    console.error("Random recipe API failure:", error);
    return NextResponse.json(
      { error: "Random recipe not available" },
      { status: 500 },
    );
  }
}

