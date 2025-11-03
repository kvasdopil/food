import { promises as fs } from "node:fs";
import path from "node:path";

type RefineResponse = {
  message: string;
  evaluation?: string;
  recipe?: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    tags: string[];
    image_url: string | null;
    created_at: string;
    updated_at: string;
  };
};

async function loadEnvValue(key: string): Promise<string | undefined> {
  if (process.env[key]) {
    return process.env[key];
  }

  const envLocalPath = path.resolve(".env.local");

  try {
    const content = await fs.readFile(envLocalPath, "utf-8");
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const [envKey, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim();
      if (!value) continue;

      if (envKey === key) {
        process.env[key] = value;
        return value;
      }
    }
  } catch {
    // silently ignore; we'll throw below if still missing
  }

  return undefined;
}

function extractSlugFromPath(inputPath: string): string | null {
  // Handle both absolute and relative paths
  const normalizedPath = path.resolve(inputPath);

  // Check if it's a YAML file in the recipes directory structure
  // Pattern: data/recipes/<slug>/<slug>.yaml
  const recipesDirPattern = /[\/\\]data[\/\\]recipes[\/\\]([^\/\\]+)[\/\\][^\/\\]+\.ya?ml$/i;
  const match = normalizedPath.match(recipesDirPattern);
  if (match && match[1]) {
    return match[1];
  }

  // If it's just a slug (no path separators or file extension)
  if (
    !inputPath.includes(path.sep) &&
    !inputPath.includes("/") &&
    !inputPath.includes("\\") &&
    !inputPath.includes(".")
  ) {
    return inputPath;
  }

  // Try to extract from any path that might be a YAML file
  // Extract the directory name before the file if it looks like a slug
  const dirName = path.dirname(normalizedPath);
  const baseName = path.basename(dirName);
  if (baseName && baseName.match(/^[a-z0-9-]+$/)) {
    return baseName;
  }

  return null;
}

function printUsage() {
  const usageMessage = `
Usage: ts-node scripts/recipe-evaluator.ts <slug|yaml-path> [options]

Arguments:
  <slug|yaml-path>    Recipe slug (e.g., "chicken-tikka-masala") or path to recipe YAML file

Options:
  --endpoint <url>     API endpoint URL (defaults to http://localhost:3000)
  --token <token>     EDIT_TOKEN for authentication (defaults to EDIT_TOKEN env var or .env.local)
  -h, --help          Show this message

Examples:
  ts-node scripts/recipe-evaluator.ts chicken-tikka-masala
  ts-node scripts/recipe-evaluator.ts data/recipes/chicken-tikka-masala/chicken-tikka-masala.yaml
  ts-node scripts/recipe-evaluator.ts chicken-tikka-masala --endpoint http://localhost:3000
`;
  console.log(usageMessage.trim());
}

async function refineRecipe(
  slug: string,
  endpoint: string,
  token: string,
): Promise<RefineResponse> {
  const url = `${endpoint}/api/recipes/${slug}/refine`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Refine API failed (${response.status} ${response.statusText}): ${errorText}`);
  }

  return (await response.json()) as RefineResponse;
}

async function main() {
  try {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
      printUsage();
      process.exit(0);
    }

    let slug: string | null = null;
    let endpoint = process.env.RECIPE_API_URL ?? "http://localhost:3000";
    let token: string | undefined;

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === "--endpoint") {
        endpoint = args[i + 1];
        if (!endpoint) {
          throw new Error("--endpoint requires a URL argument");
        }
        i++;
      } else if (arg.startsWith("--endpoint=")) {
        endpoint = arg.split("=")[1];
      } else if (arg === "--token") {
        token = args[i + 1];
        if (!token) {
          throw new Error("--token requires a token argument");
        }
        i++;
      } else if (arg.startsWith("--token=")) {
        token = arg.split("=")[1];
      } else if (arg === "--help" || arg === "-h") {
        printUsage();
        process.exit(0);
      } else if (!slug && !arg.startsWith("-")) {
        // Try to extract slug from path, or use as slug directly
        const extractedSlug = extractSlugFromPath(arg);
        if (extractedSlug) {
          slug = extractedSlug;
        } else {
          // Use as slug if it looks like one (no file extension, simple string)
          slug = arg;
        }
      } else {
        throw new Error(`Unknown argument: ${arg}`);
      }
    }

    if (!slug) {
      throw new Error("Recipe slug or YAML path is required");
    }

    // Load token if not provided
    if (!token) {
      token = await loadEnvValue("EDIT_TOKEN");
    }

    if (!token) {
      throw new Error(
        "Provide EDIT_TOKEN via --token, EDIT_TOKEN env var, or .env.local before running this script.",
      );
    }

    console.log(`Evaluating and refining recipe: ${slug}`);
    console.log(`Endpoint: ${endpoint}\n`);

    // Call the refine endpoint
    const result = await refineRecipe(slug, endpoint, token);

    // Display results
    console.log(result.message);
    console.log();

    if (result.evaluation) {
      console.log("Evaluation result:");
      console.log(result.evaluation);
      console.log();
    }

    if (result.recipe) {
      console.log("Updated recipe:");
      console.log(`  Slug: ${result.recipe.slug}`);
      console.log(`  Name: ${result.recipe.name}`);
      console.log(`  Updated: ${new Date(result.recipe.updated_at).toLocaleString()}`);
    }
  } catch (error) {
    console.error(`[recipe-evaluator] ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

void main();
