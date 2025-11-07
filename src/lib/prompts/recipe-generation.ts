export type GenerateRequest = {
  title: string;
  description: string;
  tags: string[];
  userComment?: string;
  servings?: number;
  cuisine?: string;
  variationOf?: string | null;
  isVariant?: boolean;
};

const baseRecipeSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    servings: { type: "integer" },
    prepTimeMinutes: { type: "integer" },
    cookTimeMinutes: { type: "integer" },
    ingredients: {
      type: "array",
      minItems: 6,
      items: {
        type: "object",
        required: ["name", "amount"],
        properties: {
          name: { type: "string" },
          amount: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
    instructions: {
      type: "array",
      minItems: 4,
      items: {
        type: "object",
        required: ["step", "action"],
        properties: {
          step: { type: "integer" },
          action: { type: "string" },
        },
      },
    },
    tags: {
      type: "array",
      items: { type: "string" },
    },
    variationOf: {
      type: "string",
      description:
        "Normalized base meal name if this recipe is a variation of an existing meal (e.g., 'Fried Rice', 'Tacos', 'Stir-Fry'). Only include if this is clearly a variation of a common base meal.",
    },
  },
  required: ["title", "ingredients", "instructions"],
} as const;

/**
 * Get recipe schema, excluding variationOf if we already have it (we'll override it)
 */
export function getRecipeSchema(hasVariationOf: boolean) {
  if (hasVariationOf) {
    // Exclude variationOf from schema if we already have it
    const { variationOf, ...schemaWithoutVariationOf } = baseRecipeSchema.properties;
    return {
      ...baseRecipeSchema,
      properties: schemaWithoutVariationOf,
    };
  }
  return baseRecipeSchema;
}

export function buildRecipeGenerationPrompt(options: GenerateRequest, feedback?: string): string {
  // Check if feedback mentions description/summary issues
  const hasDescriptionIssues =
    feedback &&
    (feedback.toLowerCase().includes("summary") ||
      feedback.toLowerCase().includes("description") ||
      feedback.toLowerCase().includes("consists of") ||
      feedback.toLowerCase().includes("contains") ||
      feedback.toLowerCase().includes("features"));

  const prompts: string[] = [
    `Develop a detailed recipe for "${options.title}".`,
    hasDescriptionIssues
      ? `Previous description (DO NOT use this, write a completely new one): ${options.description}`
      : `Core description provided by the product team: ${options.description}`,
    "The dish must be achievable in 60 minutes or less using widely available, budget-friendly ingredients.",
    hasDescriptionIssues
      ? "CRITICAL: Write a completely NEW summary sentence that objectively describes the dish's key components, cooking method, and distinctive features. Base it on the recipe ingredients and instructions, NOT on the previous description. Focus on what the dish is and how it's prepared, not subjective impressions. Do NOT use subjective words like 'savory', 'delicious', 'tasty', 'mouthwatering', 'appealing', 'flavorful', 'amazing', 'perfect', 'best', 'authentic', 'homemade' in the summary. Do NOT use explanatory phrases like 'This dish contains', 'This dish consists of', 'This recipe features', 'This meal includes', 'features', 'consists of', 'made with', 'made from' - instead, describe the dish directly using active, concise language. Do NOT include the meal name in the description (e.g., 'Pan-fried grated potato pancakes, served with crispy pork belly and lingonberry jam' not 'Raggmunkar with Pork Belly is a dish of pan-fried potato pancakes')."
      : "Include a short summary sentence that objectively describes the dish's key components, cooking method, and distinctive features. Focus on what the dish is and how it's prepared, not subjective impressions. CRITICAL: Do NOT use subjective words like 'savory', 'delicious', 'tasty', 'mouthwatering', 'appealing', 'flavorful', 'amazing', 'perfect', 'best', 'authentic', 'homemade' in the summary. Do NOT use explanatory phrases like 'This dish contains', 'This dish consists of', 'This recipe features', 'This meal includes', 'features', 'consists of', 'made with', 'made from' - instead, describe the dish directly using active, concise language. Do NOT include the meal name in the description (e.g., 'Pan-fried grated potato pancakes, served with crispy pork belly and lingonberry jam' not 'Raggmunkar with Pork Belly is a dish of pan-fried potato pancakes').",
    "",
    "IMPORTANT RECIPE GUIDELINES:",
    "",
    "1. RECIPE TITLE:",
    "   - Use proper grammatical forms in the title (e.g., if user requests 'burgers', title should be 'Classic Burger with French Fries', not 'Burgers')",
    "   - The title should be singular when referring to the main dish, but can include plural sides (e.g., 'Roasted Chicken Thighs with Potatoes')",
    "   - Make the title clear and appetizing",
    "   - CRITICAL: The title must ONLY contain the actual name of the meal. DO NOT include descriptive adjectives like 'savory', 'delicious', 'tasty', 'mouthwatering', 'flavorful', 'amazing', 'perfect', 'best', 'authentic', 'homemade', or any other subjective descriptors. The title should be the dish name only (e.g., 'Chicken Tikka Masala' not 'Delicious Savory Chicken Tikka Masala')",
    "",
    "2. SIDES AND COMPLETE MEALS:",
    "   - When appropriate, include a complementary side dish in the recipe (e.g., roasted chicken should include potatoes or rice)",
    "   - If the main protein would typically be served with a side, include it automatically",
    "   - Common pairings: chicken with rice/potatoes, burgers with fries, fish with vegetables, etc.",
    "   - Include side ingredients in the ingredient list and side preparation in the instructions",
    "   - Keep sides quick to prepare and complementary to the main dish",
    "",
    "CRITICAL FORMATTING RULES (must be followed exactly):",
    "",
    "3. INGREDIENT NAMES:",
    "   - All ingredient names in the ingredients array MUST be lowercase (e.g., 'chicken breast', not 'Chicken Breast')",
    "   - Ingredient amounts must NOT contain parenthetical notes; move all contextual details to the 'notes' field",
    "   - Example: { name: 'chicken breast', amount: '4', notes: 'approx. 150g each' } NOT { name: 'Chicken breast', amount: '4 (approx. 150g each)' }",
    "",
    "4. INSTRUCTIONS:",
    "   - Wrap ONLY the FIRST occurrence of each ingredient name per step in asterisks (e.g., '*chicken breast*')",
    "   - Subsequent mentions of the same ingredient in the same step should NOT have asterisks",
    "   - It's okay to use descriptive phrases in instructions (e.g., '*trimmed green beans*', '*minced garlic*') for clarity",
    "   - Keep instruction text concise and practical",
    "",
    "5. MEASUREMENTS:",
    "   - Use metric measurements with abbreviated units (g, ml, °C) plus tsp/tbsp where helpful",
    '   - You may use "1 medium", "2 large", etc., for whole produce where that feels natural',
    "   - Never use Fahrenheit, pounds, ounces, cups, or inches",
    "   - For whole units (tbsp, tsp, pieces, whole items), prefer fractions over decimals: use '1/2' instead of '0.5', '1/4' instead of '0.25', '3/4' instead of '0.75'. Only use decimals for metric measurements (g, ml) when necessary.",
    "   - Describe tiny amounts (a drizzle, a pinch) naturally instead of inventing precise measurements",
    "",
    "6. INGREDIENT REFERENCING:",
    "   - Instructions should reference ingredients from the ingredient list",
    "   - Common pantry staples (salt, pepper, oil, water, basic seasonings) can be mentioned without explicit listing in ingredients",
    "",
    "7. TAGS:",
    "   - Do NOT include individual ingredients in the tags array (e.g., do not add tags like 'garlic', 'onion', 'tomato', 'cheese', 'herbs', etc.)",
    "   - The ONLY ingredient-related tag allowed is the main protein type: 'chicken', 'beef', 'pork', 'seafood', 'vegetarian', or 'vegan'",
    "   - Tags should focus on dietary preferences, cuisine styles, and dish characteristics (e.g., 'spicy', 'gluten-free', 'italian', 'mediterranean', etc.)",
    "   - Do NOT include usecase or situational tags like 'comfort food', 'weeknight dinner', 'party food', 'quick meal', 'family-friendly', etc.",
    "   - Only include tags that were provided in the tag list or are directly relevant to the recipe category (dietary, cuisine, characteristics)",
    "",
    "8. MEAL VARIATIONS:",
    ...(options.variationOf
      ? [
          // When we already have variationOf, we'll override it - no need to mention it to LLM
        ]
      : options.isVariant
        ? [
            "   - CRITICAL: This recipe is being created as a variation of another recipe. You MUST determine the normalized base meal name and include the 'variationOf' field.",
            "   - Extract ONLY the generic base meal type from the recipe names. Remove all descriptive adjectives, proteins, and specific ingredients. Keep only the core meal category.",
            "   - Examples of correct extraction:",
            "     * 'Chicken Caesar Wraps' and 'Grilled Fish and Feta Wrap' → variationOf: 'Wraps' (NOT 'Chicken Caesar Wraps')",
            "     * 'Grilled Halloumi Burger' and 'Classic Beef Burger' → variationOf: 'Burger' (NOT 'Grilled Halloumi Burger' or 'Classic Beef Burger')",
            "     * 'Beef Tacos' and 'Chicken Tacos' → variationOf: 'Tacos' (NOT 'Beef Tacos')",
            "     * 'Honey Garlic Chicken Stir-Fry' and 'Thai Basil Shrimp Stir-Fry' → variationOf: 'Stir-Fry' (NOT the full recipe name)",
            "     * 'Miso Glazed Salmon' and 'Pan-Seared Salmon' → variationOf: 'Salmon' (NOT 'Miso Glazed Salmon')",
          ]
        : [
            "   - If this recipe is clearly a variation of a common base meal (e.g., 'Chicken Fried Rice' is a variation of 'Fried Rice', 'Beef Tacos' is a variation of 'Tacos'), include the 'variationOf' field with the normalized base meal name",
            "   - Use a normalized, generic name for the base meal (e.g., 'Fried Rice', 'Tacos', 'Stir-Fry', 'Burrito Bowls', 'Fajitas')",
            "   - Only include 'variationOf' if the recipe is clearly part of a known meal variation group",
            "   - Examples:",
            "     * 'Chicken Fried Rice' → variationOf: 'Fried Rice'",
            "     * 'Beef Tacos' → variationOf: 'Tacos'",
            "     * 'Honey Garlic Chicken Stir-Fry' → variationOf: 'Stir-Fry'",
            "     * 'Miso Glazed Salmon' → variationOf: 'Salmon'",
            "   - If the recipe is unique or not clearly a variation, omit the 'variationOf' field",
          ]),
    "",
    "Return the recipe structured JSON matching the provided schema.",
    "If you mention a side or garnish, keep it quick to prepare.",
  ];

  if (feedback) {
    prompts.push(
      "",
      "IMPORTANT: The following issues were identified in a previous version. Please fix these issues while preserving all recipe content:",
      feedback,
    );
  }

  if (options.servings) {
    prompts.push(`Target servings: ${options.servings}.`);
  }

  if (options.cuisine) {
    prompts.push(`Cuisine influence: ${options.cuisine}.`);
  }

  prompts.push(
    [
      `You must reference only the following tags when relevant (do not invent new tags): ${options.tags.join(", ")}.`,
      "If a provided tag does not apply, omit it rather than creating alternatives.",
    ].join(" "),
  );

  if (options.userComment) {
    prompts.push(`Incorporate these extra notes: ${options.userComment}.`);
  }

  return prompts.join("\n");
}
