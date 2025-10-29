import { readFile } from "node:fs/promises";
import path from "node:path";

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

const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const TEXT_MODEL = "gemini-2.5-flash";

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
    throw new Error(`Gemini API request failed (${response.status} ${response.statusText}): ${errorText}`);
  }

  return (await response.json()) as GenerateContentResponse;
}

function ensureText(response: GenerateContentResponse, errorContext: string) {
  if (response.promptFeedback?.blockReason) {
    throw new Error(`${errorContext} was blocked by Gemini: ${response.promptFeedback.blockReason}`);
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

async function main() {
  const [inputPath] = process.argv.slice(2);

  if (!inputPath) {
    console.error("Usage: ts-node scripts/recipe-evaluator.ts <path-to-recipe.yaml>");
    process.exitCode = 1;
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Set GEMINI_API_KEY (or GOOGLE_API_KEY) in your environment before running this script.");
  }

  const absolutePath = path.resolve(inputPath);
  const yamlContent = await readFile(absolutePath, "utf-8");

  const evaluationInstructions = [
    "Evaluate the provided recipe YAML against these production rules:",
    '- Use metric measurements with abbreviated units (g, ml, °C) plus tsp/tbsp where helpful. Never use Fahrenheit, pounds, ounces, cups, or inches.',
    ' - Describe tiny amounts (a drizzle, a pinch) naturally so the instructions do not invent precise measurements for them.',
    " - Mention each ingredient in lowercase within instructions and wrap the first occurrence per step in *asterisks* (e.g., *olive oil*).",
    " - Ingredient amounts should not contain parenthetical notes; move contextual details into a `notes` field.",
    " - Instructions should be concise, practical, and reference only ingredients declared in the list.",
    " - Keep ingredient names lowercase so the UI can highlight them consistently.",
    "",
    "Assess the recipe and return one of:",
    " - If issues exist, list them as Markdown bullets detailing the required change (be specific about ingredient names, steps, or fields).",
    " - If everything already complies, respond with the sentence: `All checks passed. No changes needed.`",
  ].join("\n");

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${evaluationInstructions}\n\nCurrent recipe YAML:\n${yamlContent}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
    },
  };

  const response = await callGemini(TEXT_MODEL, requestBody, apiKey);
  const result = ensureText(response, "Recipe evaluation");
  console.log(result);
}

void main();
