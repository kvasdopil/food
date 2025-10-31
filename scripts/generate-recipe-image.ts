import { promises as fs } from "node:fs";

type GenerateImageResponse = {
  slug: string;
  path: string;
  publicUrl: string;
  hash: string;
  message: string;
};

async function loadEnvValue(key: string): Promise<string | undefined> {
  if (process.env[key]) {
    return process.env[key];
  }

  const envLocalPath = ".env.local";

  try {
    const content = await fs.readFile(envLocalPath, "utf-8");
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const [lineKey, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim();
      if (!value) continue;

      if (lineKey === key) {
        process.env[key] = value;
        return value;
      }
    }
  } catch {
    // ignore missing file
  }

  return undefined;
}

async function generateImageViaApi(
  slug: string,
  endpoint: string,
  token: string,
  fireflyKey?: string,
): Promise<GenerateImageResponse> {
  const url = `${endpoint}/api/recipes/${encodeURIComponent(slug)}/generate-image`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  if (fireflyKey) {
    headers["x-firefly-key"] = fireflyKey;
  }

  console.log(`Calling API endpoint: ${url}`);
  const response = await fetch(url, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Image generation API failed (${response.status} ${response.statusText}): ${errorText}`,
    );
  }

  return (await response.json()) as GenerateImageResponse;
}

function printUsage() {
  const usageMessage = `
Usage: ts-node scripts/generate-recipe-image.ts <slug> [options]

Arguments:
  slug                    Recipe slug (e.g. my-recipe-slug)

The script will:
  1. Call the /api/recipes/[slug]/generate-image endpoint (which handles prompt enrichment, Firefly generation, upload, and DB update)
  2. Optionally download and save the image locally if --save-to is provided

Options:
  --endpoint <url>        API endpoint URL (defaults to http://localhost:3000 or RECIPE_API_URL env var)
  --token <token>         EDIT_TOKEN for API authentication (defaults to EDIT_TOKEN env var or .env.local)
  --firefly-key <key>     Firefly API key to pass via x-firefly-key header (optional)
  --save-to <path>        Optional: Download and save the image to the specified file path
  -h, --help              Show this message.
`;
  console.log(usageMessage.trim());
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
    let fireflyKey: string | undefined;
    let saveToPath: string | undefined;

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
      } else if (arg === "--firefly-key") {
        fireflyKey = args[i + 1];
        if (!fireflyKey) {
          throw new Error("--firefly-key requires a key argument");
        }
        i++;
      } else if (arg.startsWith("--firefly-key=")) {
        fireflyKey = arg.split("=")[1];
      } else if (arg === "--save-to") {
        saveToPath = args[i + 1];
        if (!saveToPath) {
          throw new Error("--save-to requires a file path argument");
        }
        i++;
      } else if (arg.startsWith("--save-to=")) {
        saveToPath = arg.split("=")[1];
      } else if (arg === "--help" || arg === "-h") {
        printUsage();
        process.exit(0);
      } else if (!slug && !arg.startsWith("-")) {
        slug = arg;
      } else {
        throw new Error(`Unknown argument: ${arg}`);
      }
    }

    if (!slug) {
      throw new Error("Recipe slug is required");
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

    console.log(`Generating image for recipe: ${slug}`);

    // Call the API endpoint
    const result = await generateImageViaApi(slug, endpoint, token, fireflyKey);

    console.log(`Image generated and uploaded successfully!`);
    console.log(`Public URL: ${result.publicUrl}`);
    console.log(`Storage path: ${result.path}`);

    // Optionally download and save locally if path is provided
    if (saveToPath) {
      console.log(`Downloading image from storage to save locally...`);
      const imageResponse = await fetch(result.publicUrl);

      if (!imageResponse.ok) {
        throw new Error(`Failed to download image from storage (${imageResponse.status})`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      await fs.writeFile(saveToPath, Buffer.from(imageBuffer));

      console.log(`Image saved to ${saveToPath}`);
    }
  } catch (error) {
    console.error(`[generate-recipe-image] ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

void main();
