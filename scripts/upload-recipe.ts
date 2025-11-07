#!/usr/bin/env ts-node

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { loadEnvValue } from "./script-utils";

type Ingredient = {
  name: string;
  amount: string;
  notes?: string;
};

type Instruction = {
  step: number;
  action: string;
};

type RecipePayload = {
  slug: string;
  title: string;
  summary?: string;
  description?: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  tags: string[];
  imageUrl?: string;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
};

type RecipeResponse = {
  recipe?: {
    slug?: string;
  };
};

type ImageResponse = {
  slug: string;
  path: string;
  publicUrl: string;
  hash: string;
  recipeUpdated: boolean;
};

type RecipeYaml = {
  title?: unknown;
  summary?: unknown;
  description?: unknown;
  slug?: unknown;
  ingredients?: unknown;
  instructions?: unknown;
  tags?: unknown;
  imageUrl?: unknown;
  image_url?: unknown;
  image?: unknown;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
};

function usage(): never {
  console.log("Usage: yarn ts-node scripts/upload-recipe.ts <recipe.yaml> [options]");
  console.log("");
  console.log("Options:");
  console.log(
    "  --endpoint <url>    Recipe API endpoint (default: http://localhost:3000/api/recipes)",
  );
  console.log("  --token <token>     Authentication token (or set EDIT_TOKEN env var)");
  console.log("  --skip-image        Skip image upload (use existing image URL from YAML)");
  process.exit(1);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeIngredients(entries: unknown): Ingredient[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((item): Ingredient | null => {
      if (typeof item === "string") {
        const [name, ...rest] = item.split(":");
        const amount = rest.join(":").trim();
        return { name: name.trim(), amount: amount || "to taste" };
      }
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const maybeName = Reflect.get(item, "name");
      const maybeAmount = Reflect.get(item, "amount");
      const maybeNotes = Reflect.get(item, "notes");
      const name = typeof maybeName === "string" ? maybeName.trim() : "";
      const amount = typeof maybeAmount === "string" ? maybeAmount.trim() : "";
      if (!name || !amount) {
        return null;
      }
      const notes = typeof maybeNotes === "string" ? maybeNotes.trim() : undefined;
      return notes ? { name, amount, notes } : { name, amount };
    })
    .filter((entry): entry is Ingredient => Boolean(entry));
}

function normalizeInstructions(entries: unknown): Instruction[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((item, index): Instruction | null => {
      if (typeof item === "string") {
        return { step: index + 1, action: item.trim() };
      }
      if (typeof item !== "object" || item === null) {
        return null;
      }

      const maybeAction = Reflect.get(item, "action");
      const action = typeof maybeAction === "string" ? maybeAction.trim() : "";
      if (!action) {
        return null;
      }

      const maybeStep = Reflect.get(item, "step");
      const step =
        typeof maybeStep === "number" && Number.isFinite(maybeStep)
          ? Math.max(1, Math.trunc(maybeStep))
          : index + 1;

      return { step, action };
    })
    .filter((entry): entry is Instruction => Boolean(entry));
}

function normalizeTags(entries: unknown): string[] {
  if (Array.isArray(entries)) {
    return entries
      .map((tag) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
      .filter(Boolean);
  }
  if (typeof entries === "string") {
    return entries
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

async function findImageFile(slug: string, yamlPath: string): Promise<string | null> {
  const directory = path.dirname(yamlPath);
  const candidates = [".jpg", ".jpeg", ".png", ".webp"];

  for (const extension of candidates) {
    const candidatePath = path.join(directory, `${slug}${extension}`);
    try {
      await access(candidatePath);
      return candidatePath;
    } catch {
      // continue searching
    }
  }

  return null;
}

async function uploadImage(
  imageApiEndpoint: string,
  token: string,
  slug: string,
  imagePath: string,
): Promise<ImageResponse> {
  const { promises: fs } = await import("node:fs");
  const fileBuffer = await fs.readFile(imagePath);
  const blob = new Blob([fileBuffer], { type: "image/jpeg" });
  const file = new File([blob], path.basename(imagePath), { type: "image/jpeg" });

  const formData = new FormData();
  formData.set("file", file);
  formData.set("slug", slug);

  const response = await fetch(imageApiEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Image upload failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as ImageResponse;
}

async function uploadRecipe(
  recipeApiEndpoint: string,
  token: string,
  payload: RecipePayload,
): Promise<RecipeResponse> {
  const response = await fetch(recipeApiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Recipe upload failed (${response.status}): ${text}`);
  }

  return (await response.json()) as RecipeResponse;
}

async function buildPayload(inputPath: string): Promise<RecipePayload> {
  const fileContent = await readFile(inputPath, "utf-8");
  const data = yaml.load(fileContent) as RecipeYaml;

  if (typeof data !== "object" || data === null) {
    throw new Error("YAML payload is empty or invalid.");
  }

  const rawTitle = data.title;
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  if (!title) {
    throw new Error("YAML must include a title.");
  }

  const rawSummary = data.summary ?? data.description;
  const summary = typeof rawSummary === "string" ? rawSummary.trim() : undefined;

  const ingredients = normalizeIngredients(data.ingredients);
  if (ingredients.length === 0) {
    throw new Error("YAML must include at least one ingredient.");
  }

  const instructions = normalizeInstructions(data.instructions);
  if (instructions.length === 0) {
    throw new Error("YAML must include at least one instruction.");
  }

  const tags = normalizeTags(data.tags);
  if (tags.length === 0) {
    throw new Error("YAML must include at least one tag.");
  }

  const slugSource =
    typeof data.slug === "string" && data.slug.trim()
      ? data.slug.trim()
      : slugify(path.basename(inputPath, path.extname(inputPath)));

  const slug = slugify(slugSource);

  const payload: RecipePayload = {
    slug,
    title,
    summary,
    description: summary,
    ingredients,
    instructions,
    tags,
  };

  // Use imageUrl from YAML if provided, otherwise it will be set after image upload
  const imageUrlCandidate =
    typeof data.imageUrl === "string"
      ? data.imageUrl.trim()
      : typeof data.image_url === "string"
        ? data.image_url.trim()
        : typeof data.image === "string"
          ? data.image.trim()
          : null;

  if (imageUrlCandidate) {
    payload.imageUrl = imageUrlCandidate;
  }

  // Extract time fields from YAML
  if (typeof data.prepTimeMinutes === "number" && Number.isFinite(data.prepTimeMinutes)) {
    payload.prepTimeMinutes = Math.max(0, Math.trunc(data.prepTimeMinutes));
  }

  if (typeof data.cookTimeMinutes === "number" && Number.isFinite(data.cookTimeMinutes)) {
    payload.cookTimeMinutes = Math.max(0, Math.trunc(data.cookTimeMinutes));
  }

  return payload;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    usage();
  }

  let recipeEndpoint = process.env.RECIPE_API_URL ?? "http://localhost:3000/api/recipes";
  let imageEndpoint = process.env.IMAGE_API_URL ?? "http://localhost:3000/api/images";
  let token: string | null = process.env.EDIT_TOKEN ?? null;
  let filePath: string | null = null;
  let skipImage = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--endpoint") {
      const next = args[i + 1];
      if (!next) usage();
      recipeEndpoint = next;
      imageEndpoint = next.replace("/api/recipes", "/api/images");
      i += 1;
    } else if (arg.startsWith("--endpoint=")) {
      recipeEndpoint = arg.split("=")[1];
      imageEndpoint = recipeEndpoint.replace("/api/recipes", "/api/images");
    } else if (arg === "--token") {
      const next = args[i + 1];
      if (!next) usage();
      token = next;
      i += 1;
    } else if (arg.startsWith("--token=")) {
      token = arg.split("=")[1];
    } else if (arg === "--skip-image") {
      skipImage = true;
    } else if (arg.startsWith("-")) {
      usage();
    } else if (!filePath) {
      filePath = arg;
    } else {
      usage();
    }
  }

  if (!filePath) {
    usage();
  }

  const absolutePath = path.resolve(process.cwd(), filePath);

  try {
    await access(absolutePath);
  } catch {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  if (!token) {
    token = (await loadEnvValue("EDIT_TOKEN")) ?? null;
  }

  if (!token) {
    console.error("Missing EDIT_TOKEN. Provide via --token, EDIT_TOKEN env var, or .env.local.");
    process.exit(1);
  }

  // Build recipe payload from YAML
  const payload = await buildPayload(absolutePath);
  const slug = payload.slug;

  // Try to find and upload image if not skipping
  if (!skipImage && !payload.imageUrl) {
    const imagePath = await findImageFile(slug, absolutePath);
    if (imagePath) {
      try {
        console.log(`Uploading image: ${path.basename(imagePath)}`);
        const imageResult = await uploadImage(imageEndpoint, token, slug, imagePath);
        payload.imageUrl = imageResult.publicUrl;
        console.log(
          `✓ Image uploaded: ${imageResult.path} (${imageResult.recipeUpdated ? "recipe updated" : "recipe will be created"})`,
        );
      } catch (error) {
        console.warn(
          `Failed to upload image: ${error instanceof Error ? error.message : String(error)}`,
        );
        console.warn("Continuing with recipe upload without image URL...");
      }
    } else {
      console.warn(`No image found for ${slug}, continuing with recipe upload without image...`);
    }
  } else if (skipImage) {
    console.log("Skipping image upload (--skip-image flag)");
  } else if (payload.imageUrl) {
    console.log(`Using image URL from YAML: ${payload.imageUrl}`);
  }

  // Upload recipe
  console.log(`Uploading recipe: ${payload.title}`);
  const result = await uploadRecipe(recipeEndpoint, token, payload);
  const uploadedSlug = result?.recipe?.slug ?? payload.slug;
  console.log(`✓ Recipe uploaded: ${uploadedSlug} → ${recipeEndpoint}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
