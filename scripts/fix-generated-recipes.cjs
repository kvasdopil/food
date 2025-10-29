#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const yaml = require("js-yaml");

const RECIPES_DIR = path.resolve(process.cwd(), "data/recipes");

const UNIT_REPLACEMENTS = [
  { pattern: /\bgrams?\b/gi, replacement: "g" },
  { pattern: /\bmillilitres\b/gi, replacement: "ml" },
  { pattern: /\bmilliliters\b/gi, replacement: "ml" },
  { pattern: /\bmillilitre\b/gi, replacement: "ml" },
  { pattern: /\bmilliliter\b/gi, replacement: "ml" },
  { pattern: /\bkilograms?\b/gi, replacement: "kg" },
  { pattern: /\bteaspoons?\b/gi, replacement: "tsp" },
  { pattern: /\btablespoons?\b/gi, replacement: "tbsp" },
  { pattern: /\bcentimetres?\b/gi, replacement: "cm" },
  { pattern: /\bcentimeters?\b/gi, replacement: "cm" },
  { pattern: /\bdegrees celsius\b/gi, replacement: "°C" },
  { pattern: /\bdegree celsius\b/gi, replacement: "°C" },
];

const DESCRIPTOR_WORDS = new Set([
  "fresh",
  "small",
  "large",
  "medium",
  "baby",
  "dried",
  "ground",
  "minced",
  "chopped",
  "finely",
  "roughly",
  "thinly",
  "thick",
  "thick-cut",
  "thin",
  "crushed",
  "whole",
  "grated",
  "shredded",
  "sliced",
  "ripe",
  "juicy",
  "zest",
  "juice",
  "soft",
  "firmer",
  "firm",
  "peeled",
  "cooked",
  "uncooked",
  "steamed",
  "smoked",
  "plain",
  "unsalted",
  "salted",
  "low-fat",
  "reduced-fat",
  "reduced",
  "sweet",
  "sweetened",
  "unsweetened",
  "toasted",
  "roasted",
  "raw",
  "extra",
  "virgin",
]);

const MEASUREMENT_TEXT_REPLACEMENTS = [
  { pattern: /\bgrams?\b/gi, replacement: "g" },
  { pattern: /\bmillilitres\b/gi, replacement: "ml" },
  { pattern: /\bmilliliters\b/gi, replacement: "ml" },
  { pattern: /\bmillilitre\b/gi, replacement: "ml" },
  { pattern: /\bmilliliter\b/gi, replacement: "ml" },
  { pattern: /\bteaspoons?\b/gi, replacement: "tsp" },
  { pattern: /\btablespoons?\b/gi, replacement: "tbsp" },
  { pattern: /\bdegrees celsius\b/gi, replacement: "°C" },
  { pattern: /\bdegree celsius\b/gi, replacement: "°C" },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyUnitReplacements(value) {
  let result = value;
  for (const { pattern, replacement } of UNIT_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  result = result.replace(/(\d)([a-zA-Z°])/g, "$1 $2");
  result = result.replace(/(\d)\s*°c/gi, "$1°C");
  result = result.replace(/°c/gi, "°C");
  return result.replace(/\s+/g, " ").trim();
}

function pluralize(word) {
  if (word.endsWith("ies")) {
    return word;
  }
  if (word.endsWith("y")) {
    return `${word.slice(0, -1)}ies`;
  }
  if (word.endsWith("s") || word.endsWith("x") || word.endsWith("z") || word.endsWith("ch") || word.endsWith("sh")) {
    return `${word}es`;
  }
  return `${word}s`;
}

function singularize(word) {
  if (word.endsWith("ies")) {
    return `${word.slice(0, -3)}y`;
  }
  if (word.endsWith("ses") || word.endsWith("xes") || word.endsWith("zes") || word.endsWith("ches") || word.endsWith("shes")) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s") && !word.endsWith("ss")) {
    return word.slice(0, -1);
  }
  return word;
}

function getIngredientVariants(name) {
  const base = name.trim().toLowerCase().replace(/\s+/g, " ");
  const tokens = base.split(" ").filter(Boolean);
  const variants = new Set();

  if (!base) {
    return [];
  }

  variants.add(base);

  if (tokens.length > 1) {
    variants.add(tokens.slice(-2).join(" "));
  }

  variants.add(tokens[tokens.length - 1]);

  const filteredTokens = tokens.filter((token) => !DESCRIPTOR_WORDS.has(token));
  if (filteredTokens.length) {
    variants.add(filteredTokens.join(" "));
    if (filteredTokens.length > 1) {
      variants.add(filteredTokens.slice(-2).join(" "));
    }
    variants.add(filteredTokens[filteredTokens.length - 1]);
  }

  for (const variant of Array.from(variants)) {
    const words = variant.split(" ");
    const lastWord = words[words.length - 1];

    const plural = variant.replace(
      new RegExp(`${escapeRegExp(lastWord)}$`),
      pluralize(lastWord),
    );
    variants.add(plural);

    const singular = variant.replace(
      new RegExp(`${escapeRegExp(lastWord)}$`),
      singularize(lastWord),
    );
    variants.add(singular);
  }

  return Array.from(variants)
    .map((variant) => variant.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function highlightStep(step, ingredients) {
  const baseStep = (step ?? "").replace(/\*/g, "");
  if (!baseStep.trim()) {
    return "";
  }

  const sortedIngredients = [...ingredients].sort((a, b) => {
    const nameA = (a.name ?? "").length;
    const nameB = (b.name ?? "").length;
    return nameB - nameA;
  });

  const modifications = [];
  const workingStep = baseStep;

  for (const ingredient of sortedIngredients) {
    const variants = getIngredientVariants(ingredient.name);
    let matched = false;

    for (const variant of variants) {
      if (!variant) continue;
      const pattern = new RegExp(`\\b${escapeRegExp(variant)}\\b`, "i");
      const match = pattern.exec(workingStep);

      if (!match) continue;

      const start = match.index;
      const end = start + match[0].length;

      if (modifications.some((item) => !(end <= item.start || start >= item.end))) {
        matched = true;
        break;
      }

      modifications.push({
        start,
        end,
        replacement: `*${match[0].toLowerCase()}*`,
      });

      matched = true;
      break;
    }

    if (!matched && ingredient.name.includes("-")) {
      const hyphenFree = ingredient.name.replace(/-/g, " ");
      const pattern = new RegExp(`\\b${escapeRegExp(hyphenFree)}\\b`, "i");
      const match = pattern.exec(workingStep);

      if (match) {
        const start = match.index;
        const end = start + match[0].length;

        if (!modifications.some((item) => !(end <= item.start || start >= item.end))) {
          modifications.push({
            start,
            end,
            replacement: `*${match[0].toLowerCase()}*`,
          });
        }
      }
    }
  }

  let result = workingStep;

  if (modifications.length) {
    modifications.sort((a, b) => b.start - a.start);

    for (const mod of modifications) {
      result = result.slice(0, mod.start) + mod.replacement + result.slice(mod.end);
    }
  }

  for (const { pattern, replacement } of MEASUREMENT_TEXT_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }

  result = result.replace(/(\d)\s*(g|ml|kg|tsp|tbsp)/gi, "$1 $2");
  result = result.replace(/(\d)\s*°c/gi, "$1°C");
  result = result.replace(/°c/g, "°C");

  return result.replace(/\s+/g, " ").replace(/\s+([,.;])/g, "$1").trim();
}

function normalizeAmount(amount, existingNotes) {
  if (!amount) {
    return {
      amount: "",
      notes: existingNotes ? [existingNotes] : [],
    };
  }

  let workingAmount = amount.toString().trim();
  const notes = [];

  workingAmount = workingAmount.replace(/\(([^)]+)\)/g, (_, captured) => {
    const trimmed = captured.trim();
    if (trimmed) {
      notes.push(trimmed);
    }
    return "";
  });

  if (workingAmount.includes(",")) {
    const [primary, secondary] = workingAmount.split(",", 2);
    workingAmount = primary.trim();
    if (secondary && secondary.trim()) {
      notes.push(secondary.trim());
    }
  }

  for (const { pattern, replacement } of UNIT_REPLACEMENTS) {
    workingAmount = workingAmount.replace(pattern, replacement);
  }

  workingAmount = workingAmount.replace(/(\d)([a-zA-Z°])/g, "$1 $2");
  workingAmount = workingAmount.replace(/\s+/g, " ").trim();

  if (existingNotes) {
    notes.unshift(existingNotes.trim());
  }

  const mergedNotes = notes
    .map((value) => applyUnitReplacements(value))
    .filter(Boolean);

  return {
    amount: applyUnitReplacements(workingAmount),
    notes: mergedNotes,
  };
}

function normalizeIngredient(ingredient) {
  const name = (ingredient.name ?? "").toString().toLowerCase().replace(/\s+/g, " ").trim();
  const { amount, notes } = normalizeAmount(ingredient.amount ?? "", ingredient.notes ?? "");

  const normalized = {
    name,
    amount,
  };

  if (notes.length) {
    normalized.notes = notes.join("; ");
  }

  return normalized;
}

function normalizeInstructions(instructions, ingredients) {
  return instructions.map((item, index) => {
    const action = highlightStep(item.action ?? "", ingredients);
    return {
      step: index + 1,
      action,
    };
  });
}

function rebuildRecipeObject(data) {
  const normalizedIngredients = (data.ingredients ?? []).map((item) => normalizeIngredient(item));
  const normalizedInstructions = normalizeInstructions(data.instructions ?? [], normalizedIngredients);

  const recipe = {
    title: data.title ?? "",
  };

  if (data.summary) recipe.summary = data.summary;
  if (data.servings !== undefined) recipe.servings = data.servings;
  if (data.prepTimeMinutes !== undefined) recipe.prepTimeMinutes = data.prepTimeMinutes;
  if (data.cookTimeMinutes !== undefined) recipe.cookTimeMinutes = data.cookTimeMinutes;

  recipe.ingredients = normalizedIngredients;
  recipe.instructions = normalizedInstructions;

  if (Array.isArray(data.tags) && data.tags.length) {
    recipe.tags = data.tags;
  }

  if (data.imagePrompt) {
    recipe.imagePrompt = data.imagePrompt;
  }

  return recipe;
}

async function processRecipe(slug) {
  const recipeDir = path.join(RECIPES_DIR, slug);
  const yamlPath = path.join(recipeDir, `${slug}.yaml`);

  const raw = await fs.readFile(yamlPath, "utf-8");
  const parsed = yaml.load(raw, { json: true }) ?? {};

  const normalized = rebuildRecipeObject(parsed);
  const serialized = yaml.dump(normalized, {
    noRefs: true,
    lineWidth: 80,
    sortKeys: false,
  });

  await fs.writeFile(yamlPath, serialized, "utf-8");
  return slug;
}

async function main() {
  const entries = await fs.readdir(RECIPES_DIR, { withFileTypes: true });
  const slugs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const updated = [];

  for (const slug of slugs) {
    try {
      await processRecipe(slug);
      updated.push(slug);
    } catch (error) {
      console.error(`Failed to normalize ${slug}: ${(error && error.message) || error}`);
    }
  }

  if (!updated.length) {
    console.log("No recipes updated.");
  } else {
    console.log(`Normalized ${updated.length} recipes.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
