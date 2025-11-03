/**
 * Google AI Image Generation using Gemini Imagen API
 * Supports generating images from text descriptions
 */

import { API_BASE_URL } from "@/lib/gemini";

export type ImageGenerationOptions = {
  description: string;
  model?: string; // Default: "gemini-2.5-flash-image"
};

export type ImageGenerationResponse = {
  imageData: Buffer;
  contentType: string;
};

/**
 * Generates an image using Google AI Gemini Imagen API
 * @param options - Generation options including description and model
 * @param apiKey - Google API key (GEMINI_API_KEY or GOOGLE_API_KEY)
 * @returns Buffer containing the generated image
 */
export async function generateImageWithGoogleAI(
  options: ImageGenerationOptions,
  apiKey: string,
): Promise<ImageGenerationResponse> {
  const { description, model = "gemini-2.5-flash-image" } = options;

  if (!description || !description.trim()) {
    throw new Error("Description is required for image generation");
  }

  // Use Gemini API endpoint for image generation
  // REST API requires contents to be a Content object, not a plain string
  const url = `${API_BASE_URL}/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: description.trim(),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      // Image generation parameters (if supported by REST API)
      // Note: aspectRatio and other image-specific configs may not be available via REST API
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google AI Gemini Image API request failed (${response.status} ${response.statusText}): ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: {
              mimeType?: string;
              data?: string; // Base64 encoded
            };
            text?: string;
          }>;
        };
      }>;
      promptFeedback?: {
        blockReason?: string;
      };
      error?: {
        code: number;
        message: string;
      };
    };

    if (data.promptFeedback?.blockReason) {
      throw new Error(`Image generation was blocked: ${data.promptFeedback.blockReason}`);
    }

    if (data.error) {
      throw new Error(`Google AI Gemini Image API error: ${data.error.message}`);
    }

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Google AI Gemini Image API did not return any candidates");
    }

    // Extract image data from response - matching the pattern from the snippet
    const parts = data.candidates[0]?.content?.parts;
    if (!parts) {
      throw new Error("Google AI Gemini Image API did not return content parts");
    }

    // Find the part with inlineData (image data)
    const imagePart = parts.find((part) => part.inlineData);

    if (!imagePart?.inlineData?.data) {
      throw new Error("Google AI Gemini Image API did not return image data");
    }

    // Decode base64 image data
    const imageBuffer = Buffer.from(imagePart.inlineData.data, "base64");
    const mimeType = imagePart.inlineData.mimeType || "image/png";

    return {
      imageData: imageBuffer,
      contentType: mimeType,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to generate image: ${String(error)}`);
  }
}
