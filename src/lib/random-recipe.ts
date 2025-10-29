export async function fetchRandomSlug(exclude?: string) {
  const url = exclude
    ? `/api/random-recipe?exclude=${encodeURIComponent(exclude)}`
    : "/api/random-recipe";

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to fetch random recipe slug");
  }

  const body = (await response.json()) as { slug?: string };
  if (!body.slug) {
    throw new Error("Random slug missing from response");
  }

  return body.slug;
}
