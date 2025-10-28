import { notFound, redirect } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

async function getRandomSlug() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc("get_random_recipe");

  if (error) {
    console.error("Failed to fetch random recipe slug:", error);
    return null;
  }

  const slug = data && data.length > 0 ? data[0]?.slug : null;
  return typeof slug === "string" && slug.length > 0 ? slug : null;
}

export default async function Home() {
  const slug = await getRandomSlug();

  if (!slug) {
    notFound();
  }

  redirect(`/recipes/${slug}`);
}

