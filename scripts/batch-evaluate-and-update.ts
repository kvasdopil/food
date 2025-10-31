#!/usr/bin/env ts-node

import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import yaml from "js-yaml";

const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const TEXT_MODEL = "gemini-2.5-flash";
const RECIPES_DIR = path.resolve(process.cwd(), "data/recipes");

type GenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
};

type RecipeDirInfo = {
  path: string;
  slug: string;
  yamlPath: string;
  ctime: Date;
};

async function loadEnvKey(): Promise<string | undefined> {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  if (process.env.GOOGLE_API_KEY) {
    return process.env.GOOGLE_API_KEY;
  }

  const envLocalPath = path.resolve(".env.local");

  try {
    const content = await fs.readFile(envLocalPath, "utf-8");
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim();
      if (!value) continue;

      if (key === "GEMINI_API_KEY") {
        process.env.GEMINI_API_KEY = value;
        return value;
      }

      if (key === "GOOGLE_API_KEY") {
        process.env.GOOGLE_API_KEY = value;
        return value;
      }
    }
  } catch {
    // silently ignore; we'll throw below if still missing
  }

  return undefined;
}

async function callGemini(model: string, body: Record<string, unknown>, apiKey: string) {
  const url = `${API_BASE_URL}/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini API request failed (${response.status} ${response.statusText}): ${errorText}`,
    );
  }

  return (await response.json()) as GenerateContentResponse;
}

function ensureText(response: GenerateContentResponse, errorContext: string) {
  if (response.promptFeedback?.blockReason) {
    throw new Error(
      `${errorContext} was blocked by Gemini: ${response.promptFeedback.blockReason}`,
    );
  }

  const text = response.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error(`Gemini did not return text for: ${errorContext}`);
  }

  return text;
}

async function runEvaluator(yamlPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(process.cwd(), "scripts/recipe-evaluator.ts");
    const child = spawn("ts-node", [scriptPath, yamlPath], {
      cwd: process.cwd(),
      stdio: ["inherit", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Evaluator failed with code ${code}: ${stderr || stdout}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

async function fixYamlWithGemini(
  yamlPath: string,
  originalContent: string,
  issues: string,
  apiKey: string,
): Promise<string> {
  const fixInstructions = [
    "CRITICAL: Content preservation is the MOST IMPORTANT rule. Never make changes that would:",
    "  - Remove ingredients, steps, or cooking instructions",
    "  - Eliminate ingredient uses (e.g., if an ingredient appears in multiple steps, ensure all uses are preserved)",
    "  - Change the recipe's cooking method, timing, or essential instructions",
    "  - Remove or consolidate duplicate ingredient entries unless they are truly redundant",
    "",
    "You are fixing a recipe YAML file. The following issues were identified:",
    issues,
    "",
    "Apply ONLY the fixes specified in the issues list above. Return the COMPLETE fixed YAML file.",
    "Preserve all content - do not remove any ingredients, steps, or instructions.",
    "Keep the same structure and all fields from the original.",
  ].join("\n");

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${fixInstructions}\n\nOriginal YAML:\n${originalContent}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
    },
  };

  const response = await callGemini(TEXT_MODEL, requestBody, apiKey);
  let fixedYaml = ensureText(response, "YAML fix");

  // Extract YAML from markdown code blocks if present
  const codeBlockMatch = fixedYaml.match(/```(?:yaml)?\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    fixedYaml = codeBlockMatch[1];
  }

  return fixedYaml;
}

async function uploadRecipe(yamlPath: string, token: string, endpoint?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(process.cwd(), "scripts/upload-recipe.ts");
    const args = [scriptPath, yamlPath, "--skip-image"];
    if (endpoint) {
      args.push("--endpoint", endpoint);
    }
    if (token) {
      args.push("--token", token);
    }

    const child = spawn("ts-node", args, {
      cwd: process.cwd(),
      stdio: "inherit",
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Upload failed with code ${code}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

async function getLatestRecipeDirs(limit: number): Promise<RecipeDirInfo[]> {
  const entries = await fs.readdir(RECIPES_DIR, { withFileTypes: true });
  const recipeDirs: RecipeDirInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dirPath = path.join(RECIPES_DIR, entry.name);
    const yamlPath = path.join(dirPath, `${entry.name}.yaml`);

    try {
      // Check if YAML file exists
      await fs.access(yamlPath);
      const stats = await fs.stat(dirPath);
      recipeDirs.push({
        path: dirPath,
        slug: entry.name,
        yamlPath,
        ctime: stats.birthtime,
      });
    } catch {
      // Skip if YAML doesn't exist
      continue;
    }
  }

  // Sort by creation time (newest first) and take latest N
  recipeDirs.sort((a, b) => b.ctime.getTime() - a.ctime.getTime());
  return recipeDirs.slice(0, limit);
}

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
      if (envKey?.trim() === key) {
        const value = rest.join("=").trim();
        if (value) {
          return value;
        }
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

async function main() {
  console.log("Getting latest 30 recipe directories...");
  const recipes = await getLatestRecipeDirs(30);
  console.log(`Found ${recipes.length} recipes to process\n`);

  const apiKey = await loadEnvKey();
  if (!apiKey) {
    throw new Error(
      "Provide GEMINI_API_KEY (or GOOGLE_API_KEY) via env or .env.local before running this script.",
    );
  }

  const editToken = await loadEnvValue("EDIT_TOKEN");
  if (!editToken) {
    throw new Error("Provide EDIT_TOKEN via env or .env.local before running this script.");
  }

  const endpoint = process.env.RECIPE_API_URL || "http://localhost:3000";

  const results = {
    passed: 0,
    fixed: 0,
    errors: 0,
  };

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    console.log(`[${i + 1}/${recipes.length}] Processing: ${recipe.slug}`);

    try {
      // Run evaluator
      const evaluationResult = await runEvaluator(recipe.yamlPath);

      // Check if evaluation passed
      if (evaluationResult.includes("All checks passed. No changes needed.")) {
        console.log(`  ✓ All checks passed\n`);
        results.passed++;
        continue;
      }

      // Issues found - need to fix
      console.log(`  ⚠ Issues found, fixing...`);
      const originalContent = await fs.readFile(recipe.yamlPath, "utf-8");

      // Use Gemini to fix the YAML
      const fixedContent = await fixYamlWithGemini(
        recipe.yamlPath,
        originalContent,
        evaluationResult,
        apiKey,
      );

      // Validate the fixed YAML can be parsed
      try {
        yaml.load(fixedContent);
      } catch (error) {
        console.error(
          `  ✗ Fixed YAML is invalid: ${error instanceof Error ? error.message : String(error)}`,
        );
        results.errors++;
        continue;
      }

      // Write fixed YAML
      await fs.writeFile(recipe.yamlPath, fixedContent, "utf-8");
      console.log(`  ✓ YAML updated`);

      // Upload to database
      await uploadRecipe(recipe.yamlPath, editToken, endpoint);
      console.log(`  ✓ Database updated\n`);
      results.fixed++;
    } catch (error) {
      console.error(
        `  ✗ Error processing ${recipe.slug}: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      results.errors++;
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Passed: ${results.passed}`);
  console.log(`Fixed & Updated: ${results.fixed}`);
  console.log(`Errors: ${results.errors}`);
  console.log(`Total: ${recipes.length}`);
}

void main();
