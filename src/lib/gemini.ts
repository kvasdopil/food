export const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const TEXT_MODEL = "gemini-2.5-flash";

export type GenerateContentResponse = {
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

/**
 * Loads the Gemini API key from environment variables
 * @throws Error if API key is not found
 */
function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required");
  }
  return apiKey;
}

/**
 * Calls the Gemini API with the specified model and request body.
 * The API key is automatically loaded from environment variables.
 * @param model - The model name (e.g., "gemini-2.5-flash")
 * @param body - The request body for the API call
 * @returns The API response
 */
export async function callGemini(
  model: string,
  body: Record<string, unknown>,
): Promise<GenerateContentResponse> {
  const apiKey = getGeminiApiKey();
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

export function ensureText(response: GenerateContentResponse, errorContext: string): string {
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
