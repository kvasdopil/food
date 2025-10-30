#!/usr/bin/env ts-node

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

type Ingredient = {
  name: string;
  amount: string;
  notes?: string;
};

type Instruction = {
  step: number;
  action: string;
};

type UploadPayload = {
  slug: string;
  title: string;
  summary?: string;
  description?: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  tags: string[];
  imageUrl?: string;
};

type UploadResponse = {
  recipe?: {
    slug?: string;
  };
};

type ManifestEntry = {
  slug: string;
  publicUrl: string;
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
};

const MANIFEST_PATH = path.resolve("data/recipe-storage-manifest.json");
let manifestCache: ManifestEntry[] | undefined;

function usage(): never {
  console.log(
    "Usage: yarn ts-node scripts/upload-recipe.ts <file.yaml> [--endpoint <url>] [--token <token>]",
  );
  process.exit(1);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      console.warn(`Failed to read .env.local: ${err.message}`);
    }
  }

  return undefined;
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

async function loadManifest(): Promise<ManifestEntry[]> {
  if (manifestCache) {
    return manifestCache;
  }

  try {
    const content = await readFile(MANIFEST_PATH, "utf-8");
    const parsed = JSON.parse(content) as unknown;
    if (Array.isArray(parsed)) {
      manifestCache = parsed
        .map((entry): ManifestEntry | null => {
          if (!entry || typeof entry !== "object") return null;
          const slug = Reflect.get(entry, "slug");
          const publicUrl = Reflect.get(entry, "publicUrl");
          if (typeof slug === "string" && typeof publicUrl === "string") {
            return { slug, publicUrl };
          }
          return null;
        })
        .filter((entry): entry is ManifestEntry => Boolean(entry));
    } else {
      manifestCache = [];
    }
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      console.warn(`Unable to read manifest at ${MANIFEST_PATH}: ${err.message}`);
    }
    manifestCache = [];
  }

  return manifestCache;
}

async function getManifestImageUrl(slug: string): Promise<string | undefined> {
  const manifest = await loadManifest();
  const match = manifest.find((entry) => entry.slug === slug);
  return match?.publicUrl;
}

async function findLocalImageExtension(slug: string, inputPath: string): Promise<string | undefined> {
  const directory = path.dirname(inputPath);
  const candidates = [".jpg", ".jpeg", ".png", ".webp"];

  for (const extension of candidates) {
    const candidatePath = path.join(directory, `${slug}${extension}`);
    try {
      await access(candidatePath);
      return extension;
    } catch {
      // continue searching
    }
  }

  return undefined;
}

async function resolveImageUrl(
  slug: string,
  providedUrl: string | null,
  inputPath: string,
): Promise<string | undefined> {
  if (providedUrl) {
    return providedUrl;
  }

  const manifestUrl = await getManifestImageUrl(slug);
  if (manifestUrl) {
    return manifestUrl;
  }

  const supabaseUrl =
    process.env.RECIPE_IMAGE_BASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL;

  if (supabaseUrl) {
    const extension = await findLocalImageExtension(slug, inputPath);
    if (extension) {
      const bucket = process.env.RECIPE_STORAGE_BUCKET || "recipe-images";
      const base = supabaseUrl.replace(/\/$/, "");
      return `${base}/storage/v1/object/public/${bucket}/${slug}${extension}`;
    }
  }

  return undefined;
}

async function buildPayload(inputPath: string): Promise<UploadPayload> {
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

  const imageUrlCandidate =
    typeof data.imageUrl === "string"
      ? data.imageUrl.trim()
      : typeof data.image_url === "string"
        ? data.image_url.trim()
        : typeof data.image === "string"
          ? data.image.trim()
          : null;

  const slug = slugify(slugSource);

  const payload: UploadPayload = {
    slug,
    title,
    summary,
    description: summary,
    ingredients,
    instructions,
    tags,
  };

  const resolvedImageUrl = await resolveImageUrl(slug, imageUrlCandidate, inputPath);
  if (resolvedImageUrl) {
    payload.imageUrl = resolvedImageUrl;
  }

  return payload;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    usage();
  }

  let endpoint = process.env.RECIPE_API_URL ?? "http://localhost:3000/api/recipes";
  let token: string | null = process.env.EDIT_TOKEN ?? null;
  let filePath: string | null = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--endpoint") {
      const next = args[i + 1];
      if (!next) usage();
      endpoint = next;
      i += 1;
    } else if (arg.startsWith("--endpoint=")) {
      endpoint = arg.split("=")[1];
    } else if (arg === "--token") {
      const next = args[i + 1];
      if (!next) usage();
      token = next;
      i += 1;
    } else if (arg.startsWith("--token=")) {
      token = arg.split("=")[1];
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
    token = await loadEnvValue("EDIT_TOKEN") ?? null;
  }

  if (!token) {
    console.error("Missing EDIT_TOKEN. Provide via --token, EDIT_TOKEN env var, or .env.local.");
    process.exit(1);
  }

  const payload = await buildPayload(absolutePath);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Request failed (${response.status}):\n${text}`);
    process.exit(1);
  }

  const result = (await response.json()) as UploadResponse;
  const slug = result?.recipe?.slug ?? payload.slug;
  console.log(`Uploaded recipe ${slug} → ${endpoint}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
