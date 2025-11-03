export type GenerateRequest = {
  title: string;
  description: string;
  tags: string[];
  userComment?: string;
  servings?: number;
  cuisine?: string;
};

export const recipeSchema = {
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
  },
  required: ["title", "ingredients", "instructions"],
} as const;

export function buildRecipeGenerationPrompt(options: GenerateRequest, feedback?: string): string {
  const prompts: string[] = [
    `Develop a detailed recipe for "${options.title}".`,
    `Core description provided by the product team: ${options.description}`,
    "The dish must be achievable in 60 minutes or less using widely available, budget-friendly ingredients.",
    "Include a short summary sentence that captures the flavor and vibe of the meal.",
    "",
    "IMPORTANT RECIPE GUIDELINES:",
    "",
    "1. RECIPE TITLE:",
    "   - Use proper grammatical forms in the title (e.g., if user requests 'burgers', title should be 'Classic Burger with French Fries', not 'Burgers')",
    "   - The title should be singular when referring to the main dish, but can include plural sides (e.g., 'Roasted Chicken Thighs with Potatoes')",
    "   - Make the title clear and appetizing",
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
