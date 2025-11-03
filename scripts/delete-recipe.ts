#!/usr/bin/env ts-node

import { readFile } from "node:fs/promises";
import path from "node:path";

function usage(): never {
  console.log("Usage: yarn ts-node scripts/delete-recipe.ts <slug>");
  console.log("");
  console.log("Example:");
  console.log("  yarn ts-node scripts/delete-recipe.ts savoury-minced-meat-pancakes");
  process.exit(1);
}

async function loadEnvValue(key: string): Promise<string | undefined> {
  const envValue = process.env[key];
  if (envValue) {
    return envValue;
  }

  const envPath = path.resolve(process.cwd(), ".env.local");

  try {
    const content = await readFile(envPath, "utf-8");
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const [lhs, ...rhs] = line.split("=");
      if (!lhs || rhs.length === 0) continue;
      const currentKey = lhs.trim();
      if (currentKey !== key) continue;
      const value = rhs.join("=").trim();
      if (value) {
        return value;
      }
    }
  } catch (error) {
    // .env.local doesn't exist or can't be read - that's okay
  }

  return undefined;
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
    console.error("Error: EDIT_TOKEN is required. Set it in .env.local or as an environment variable.");
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

