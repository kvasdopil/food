export const EVALUATION_PROMPT = [
  "CRITICAL: Content preservation is the MOST IMPORTANT rule. Never suggest changes that would:",
  "  - Remove ingredients, steps, or cooking instructions",
  "  - Eliminate ingredient uses (e.g., if an ingredient appears in multiple steps, ensure all uses are preserved)",
  "  - Change the recipe's cooking method, timing, or essential instructions",
  "  - Remove or consolidate duplicate ingredient entries unless they are truly redundant (e.g., same ingredient with different notes/amounts for different uses should be preserved)",
  "  - Alter the logical flow or completeness of the recipe",
  "",
  "Evaluate the provided recipe YAML against these production rules (formatting rules are secondary to content preservation):",
  '- Use metric measurements with abbreviated units (g, ml, °C) plus tsp/tbsp where helpful. You may use descriptions such as "1 medium" or "2 large" for whole produce, but never revert to Fahrenheit, pounds, ounces, or cups.',
  " - Describe tiny amounts (a drizzle, a pinch) naturally so the instructions do not invent precise measurements for them.",
  " - Mention each ingredient in lowercase within instructions and wrap the first occurrence per step in *asterisks* (e.g., *olive oil*).",
  " - It's acceptable to use descriptive phrases in instructions (e.g., *trimmed green beans*, *minced garlic*) for clarity - you don't need to match ingredient list names exactly.",
  " - Ingredient amounts should not contain parenthetical notes; move contextual details into a `notes` field.",
  " - Instructions should be concise and practical. They should reference the ingredient list, except for common pantry staples (salt, pepper, oil, water, basic seasonings) which may be mentioned without explicit listing.",
  " - Keep ingredient names in the ingredients array lowercase so the UI can highlight them consistently.",
  "",
  "When suggesting fixes:",
  "  - ONLY suggest formatting and structural changes (case, asterisks, note placement)",
  "  - NEVER suggest removing ingredients, steps, or instruction content",
  "  - NEVER suggest changing descriptive phrases in instructions to match ingredient list names exactly (e.g., don't change '*trimmed green beans*' to '*green beans*' or '*minced garlic*' to '*garlic*')",
  "  - If an ingredient appears multiple times (e.g., frozen peas used in filling AND as side dish), preserve ALL uses",
  "  - If splitting or clarifying ingredient entries, ensure the total usage matches the original",
  "",
  "Assess the recipe and return one of:",
  " - If issues exist, list them as Markdown bullets detailing the required change (be specific about ingredient names, steps, or fields). Only suggest fixes that preserve all content.",
  " - If everything already complies, respond with the sentence: `All checks passed. No changes needed.`",
].join("\n");

export function buildEvaluationPrompt(yamlContent: string): string {
  return `${EVALUATION_PROMPT}\n\nCurrent recipe YAML:\n${yamlContent}`;
}
