export type RecipeData = {
  slug: string;
  name: string;
  description: string;
  ingredients: string;
  instructions: string;
  imageUrl: string | null;
  tags: string[];
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
};

export async function fetchRecipeData(slug: string): Promise<RecipeData | null> {
  try {
    const response = await fetch(`/api/recipes/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.error("Failed to load recipe:", response.statusText);
      return null;
    }

    const data = (await response.json()) as RecipeData;
    return data;
  } catch (error) {
    console.error("Failed to load recipe:", error);
    return null;
  }
}
