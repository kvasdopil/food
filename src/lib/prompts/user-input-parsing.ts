export type ParsedUserInput = {
  title: string;
  description: string;
  tags: string[];
  userComment?: string;
  servings?: number;
  cuisine?: string;
};

export const userInputParsingSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    tags: {
      type: "array",
      items: { type: "string" },
    },
    userComment: { type: "string" },
    servings: { type: "integer" },
    cuisine: { type: "string" },
  },
  required: ["title", "description", "tags"],
} as const;

export function buildUserInputParsingPrompt(userInput: string): string {
  return `You are analyzing a customer request and offering a meal suitable for them. You will receive a user request about a meal and should generate a meal name, short description, and tags.

User input: "${userInput}"

Extract and return a JSON object with the following structure:
{
  "title": "A clear, concise meal name suitable for a restaurant menu",
  "description": "A concise, descriptive description explaining ingredients, cooking method, and side dish",
  "tags": ["array", "of", "relevant", "tags"],
  "userComment": "optional additional notes or requirements from the user",
  "servings": optional number,
  "cuisine": "optional cuisine type if mentioned"
}

CRITICAL GUIDELINES:

1. MEAL NAME (for restaurant menu):
   - Must be short, clear, and unambiguous
   - Should include the meal name only
   - Must NOT include any subjective words like "juicy", "savory", "delicious", "tasty", "mouthwatering", "flavorful", "amazing", "perfect", "best", "authentic", "homemade", or any other subjective descriptors
   - It's okay to add details to enhance the meal (e.g., if user asks "jerk chicken with rice", you can offer "Jerk Chicken with Coconut Rice")
   - Examples of good titles: "Chicken Tikka Masala", "Miso Glazed Salmon", "Falafel Mezze Plates", "Jerk Chicken with Coconut Rice"
   - Examples of bad titles: "Delicious Savory Chicken Tikka Masala", "Juicy Miso Glazed Salmon", "Authentic Falafel Mezze Plates"

2. MEAL DESCRIPTION:
   - Must be on point and descriptive
   - Should explain: key ingredients and components, cooking method, and side dish when applicable
   - Must be OBJECTIVE and OPINIONATED - choose ONE specific cooking method and ONE specific preparation style
   - CRITICAL: Do NOT offer choices (e.g., avoid "grilled or roasted", "sautéed or braised"). Instead, be prescriptive and choose the most appropriate method (e.g., "grilled", "roasted", "sautéed", "braised", "simmered", "broiled")
   - Must be objective and factual - describe what the dish is and how it's prepared
   - CRITICAL: Avoid ALL subjective language including "savory", "delicious", "tasty", "mouthwatering", "appealing", "flavorful", "amazing", "perfect", "best", "authentic", "homemade", or any impressions about flavor/texture
   - Should be 1-2 sentences, concise but informative
   - Examples:
     * "Yogurt-marinated chicken simmered in creamy spiced tomato sauce, served with basmati rice and cooling cucumber salad."
     * "Herb chickpea patties with hummus, tabbouleh, and pickled vegetables, accompanied by warm pita triangles."
     * "Broiled salmon lacquered with sweet-savory miso sauce, accompanied by sesame bok choy and rice."
     * "Grilled jerk-spiced chicken with coconut rice and plantains."

3. TAGS:
   - MUST always include:
     * Main protein type: one of "seafood", "pork", "beef", "chicken", "vegetarian", or "vegan" (based on the dish, infer from ingredients even if not explicitly stated)
     * Country or region of origin: infer the cuisine style and add appropriate tags like "italian", "mediterranean", "thai", "indian", "mexican", "chinese", "japanese", "french", "middleeastern", etc. (even if not explicitly mentioned, infer from dish characteristics)
     * Include "vegan" or "vegetarian" if the dish is plant-based (vegetarian includes dairy/eggs, vegan excludes all animal products)
   - MUST include "spicy" if the dish is spicy (only if it's actually spicy - no need to mention "mild spicy" or "little spicy", only mention if it's genuinely spicy)
   - DO NOT include individual ingredient names like "garlic", "onion", "tomato", "cheese", "herbs", etc.
   - DO NOT include usecase or situational tags like "comfort food", "weeknight dinner", "party food", "quick meal", "family-friendly", etc.
   - Optional tags: include "glutenfree" or "gluten-free" if the dish is naturally gluten-free or if explicitly mentioned
   - IMPORTANT: Always generate tags even if the user didn't explicitly mention them - infer them from the dish description and ingredients

4. EXAMPLES OF GOOD OUTPUT:

Example 1:
{
  "title": "Chicken Tikka Masala",
  "description": "Yogurt-marinated chicken simmered in creamy spiced tomato sauce, served with basmati rice and cooling cucumber salad.",
  "tags": ["chicken", "indian", "glutenfree"]
}

Example 2:
{
  "title": "Falafel Mezze Plates",
  "description": "Herb chickpea patties with hummus, tabbouleh, and pickled vegetables, accompanied by warm pita triangles.",
  "tags": ["vegan", "middleeastern"]
}

Example 3:
{
  "title": "Miso Glazed Salmon",
  "description": "Broiled salmon lacquered with sweet-savory miso sauce, accompanied by sesame bok choy and rice.",
  "tags": ["seafood", "japanese"]
}

5. MEAL ENHANCEMENT:
   - You are offering a meal to the customer, not just repeating their request
   - It's acceptable and encouraged to add thoughtful details that enhance the meal
   - For example: if customer asks "jerk chicken with rice", you can offer "Jerk Chicken with Coconut Rice" (adding coconut to the rice)
   - For example: if customer asks "chicken curry", you can offer "Chicken Tikka Masala" (adding a specific curry type)
   - However, respect the core request - don't change the main protein or completely transform the dish unless the customer's request is very vague

6. ADDITIONAL NOTES:
   - Include any specific requirements or preferences in userComment
   - Extract servings and cuisine only if explicitly mentioned
   - Return only valid JSON, no additional text`;
}
