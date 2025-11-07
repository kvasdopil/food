#!/usr/bin/env ts-node

import { loadEnvValue } from "./script-utils";

function usage(): never {
  console.log("Usage: yarn ts-node scripts/delete-recipe.ts <slug>");
  console.log("");
  console.log("Example:");
  console.log("  yarn ts-node scripts/delete-recipe.ts savoury-minced-meat-pancakes");
  process.exit(1);
}

async function deleteRecipe() {
  const slug = process.argv[2];

  if (!slug) {
    console.error("Error: Recipe slug is required.");
    usage();
  }

  const editToken = await loadEnvValue("EDIT_TOKEN");
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

  if (!editToken) {
    console.error(
      "Error: EDIT_TOKEN is required. Set it in .env.local or as an environment variable.",
    );
    process.exit(1);
  }

  console.log(`Deleting recipe with slug: ${slug}`);

  try {
    const response = await fetch(`${apiBaseUrl}/api/recipes/${slug}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${editToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`Error deleting recipe: ${data.error || response.statusText}`);
      process.exit(1);
    }

    console.log(`Successfully deleted recipe: ${slug}`);
    if (data.message) {
      console.log(data.message);
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    process.exit(1);
  }
}

deleteRecipe().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
