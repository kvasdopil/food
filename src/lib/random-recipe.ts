export async function fetchRandomSlug(exclude?: string) {
  // Use recipes endpoint with from parameter for slug-based pagination
  // This ensures recipes match the feed order
  const url = exclude
    ? `/api/recipes?from=${encodeURIComponent(exclude)}`
    : "/api/recipes";

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to fetch next recipe slug");
  }

  const body = (await response.json()) as { recipes?: Array<{ slug: string }> };
  
  if (!body.recipes || body.recipes.length === 0) {
    // If no recipes found after the exclude slug, wrap around to the first recipe
    // This handles the case where we're at the end of the feed
    const firstPageResponse = await fetch("/api/recipes?page=1", { cache: "no-store" });
    if (!firstPageResponse.ok) {
      throw new Error("Failed to fetch first recipe slug");
    }
    const firstPageBody = (await firstPageResponse.json()) as { recipes?: Array<{ slug: string }> };
    if (!firstPageBody.recipes || firstPageBody.recipes.length === 0) {
      throw new Error("No recipes available");
    }
    // If exclude is provided and it's the first recipe, skip it
    const firstRecipe = firstPageBody.recipes[0];
    if (exclude && firstRecipe.slug === exclude && firstPageBody.recipes.length > 1) {
      return firstPageBody.recipes[1].slug;
    }
    return firstRecipe.slug;
  }

  // Return the first recipe from the response (the next one in feed order)
  return body.recipes[0].slug;
}
