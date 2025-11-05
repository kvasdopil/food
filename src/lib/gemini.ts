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

/**
 * Streams content from the Gemini API with the specified model and request body.
 * The API key is automatically loaded from environment variables.
 * @param model - The model name (e.g., "gemini-2.5-flash")
 * @param body - The request body for the API call
 * @returns An async generator that yields text chunks as they arrive
 */
export async function* streamGemini(
  model: string,
  body: Record<string, unknown>,
): AsyncGenerator<string, void, unknown> {
  const apiKey = getGeminiApiKey();
  const url = `${API_BASE_URL}/models/${model}:streamGenerateContent?key=${apiKey}`;
  
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
      `Gemini API streaming request failed (${response.status} ${response.statusText}): ${errorText}`,
    );
  }

  if (!response.body) {
    throw new Error("Response body is null or undefined");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let rawChunkCount = 0;
  let textChunkCount = 0;

  // Helper function to extract complete NDJSON objects from buffer
  function extractCompleteObjects(buffer: string): { objects: string[]; remaining: string } {
    const objects: string[] = [];
    let currentPos = 0;
    let startPos = -1;
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    while (currentPos < buffer.length) {
      const char = buffer[currentPos];

      // Track string boundaries
      if (char === '"' && !escapeNext) {
        inString = !inString;
      }
      escapeNext = char === '\\' && inString;

      if (!inString) {
        if (char === '{') {
          if (depth === 0) {
            startPos = currentPos;
          }
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0 && startPos !== -1) {
            // Found a complete object
            const objEnd = currentPos + 1;
            // Check if followed by newline (NDJSON separator) or end of buffer
            if (objEnd >= buffer.length || buffer[objEnd] === '\n' || buffer[objEnd] === '\r') {
              const objText = buffer.substring(startPos, objEnd);
              objects.push(objText);
              // Skip the newline(s) after the object
              let nextPos = objEnd;
              while (nextPos < buffer.length && (buffer[nextPos] === '\n' || buffer[nextPos] === '\r')) {
                nextPos++;
              }
              currentPos = nextPos - 1; // -1 because we'll increment in the loop
              startPos = -1;
            }
          }
        }
      }

      currentPos++;
    }

    // Return remaining buffer (everything after the last complete object)
    const lastCompleteEnd = objects.length > 0 
      ? buffer.lastIndexOf('}') + 1
      : 0;
    const remaining = buffer.substring(lastCompleteEnd);

    return { objects, remaining };
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log(`[Gemini Stream] Stream finished. Raw chunks: ${rawChunkCount}, Text chunks yielded: ${textChunkCount}, Final buffer length: ${buffer.length}`);
        break;
      }

      rawChunkCount++;
      console.log(`[Gemini Stream] Received raw chunk ${rawChunkCount}, bytes: ${value.length}`);

      // Decode the chunk and add to buffer
      const decodedChunk = decoder.decode(value, { stream: true });
      buffer += decodedChunk;

      // Extract complete JSON objects from buffer
      const { objects, remaining } = extractCompleteObjects(buffer);
      buffer = remaining;

      console.log(`[Gemini Stream] Extracted ${objects.length} complete objects, buffer remaining: ${buffer.length}`);

      for (const objText of objects) {
        try {
          // Parse the streaming response chunk
          const chunk = JSON.parse(objText) as {
            candidates?: Array<{
              content?: {
                parts?: Array<{
                  text?: string;
                }>;
              };
            }>;
          };

          // Extract text from the chunk
          const text = chunk.candidates
            ?.flatMap((candidate) => candidate.content?.parts ?? [])
            .map((part) => part.text ?? "")
            .join("");

          if (text) {
            console.log(`[Gemini Stream] Yielding text chunk ${++textChunkCount}, length: ${text.length}`, {
              textPreview: text.substring(0, 100),
            });
            yield text;
          }
        } catch (parseError) {
          // Skip malformed JSON (shouldn't happen with complete objects, but be safe)
          console.log(`[Gemini Stream] Failed to parse complete object:`, parseError instanceof Error ? parseError.message : String(parseError));
          continue;
        }
      }
    }

    // Process any remaining buffer content
    if (buffer.trim()) {
      console.log(`[Gemini Stream] Processing final buffer: ${buffer.length} chars`);
      try {
        const chunk = JSON.parse(buffer.trim()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{
                text?: string;
              }>;
            };
          }>;
        };

        const text = chunk.candidates
          ?.flatMap((candidate) => candidate.content?.parts ?? [])
          .map((part) => part.text ?? "")
          .join("");

        if (text) {
          console.log(`[Gemini Stream] Extracted text from final buffer: ${text.length} chars`);
          textChunkCount++;
          yield text;
        }
      } catch (parseError) {
        console.log(`[Gemini Stream] Failed to parse final buffer:`, parseError instanceof Error ? parseError.message : String(parseError));
        // Ignore incomplete final chunk
      }
    }
  } finally {
    reader.releaseLock();
  }
}
