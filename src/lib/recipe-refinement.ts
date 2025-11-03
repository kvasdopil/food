import { callGemini, ensureText, TEXT_MODEL } from "./gemini";
import { buildEvaluationPrompt } from "./prompts/recipe-evaluation";
import { type RecipeData, recipeToYamlString } from "./recipe-utils";

export async function evaluateRecipe(recipe: RecipeData, apiKey: string): Promise<string> {
  const yamlContent = recipeToYamlString(recipe);
  const prompt = buildEvaluationPrompt(yamlContent);

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
    },
  };

  const response = await callGemini(TEXT_MODEL, requestBody, apiKey);
  return ensureText(response, "Recipe evaluation");
}
