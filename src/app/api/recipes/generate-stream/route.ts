import { type NextRequest } from "next/server";
import { streamGemini, TEXT_MODEL } from "@/lib/gemini";
import {
  buildRecipeGenerationPrompt,
  getRecipeSchema,
  type GenerateRequest,
} from "@/lib/prompts/recipe-generation";
import { PartialJsonParser } from "@/lib/partial-json-parser";
import { authenticateRequest } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const endpointStartTime = Date.now();

  // Authenticate the request
  const auth = await authenticateRequest(request);

  if (!auth.authorized) {
    return Response.json({ error: auth.error || "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch (error) {
    console.error("Invalid JSON payload:", error);
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = json as Record<string, unknown>;

  // This endpoint now only accepts structured data (title, description, tags)
  // User input parsing is handled by the separate parse-user-input-stream endpoint
  if (!("title" in payload) || !("description" in payload) || !("tags" in payload)) {
    return Response.json(
      { error: "Payload must include 'title', 'description', and 'tags'." },
      { status: 400 },
    );
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const tagsInput = Array.isArray(payload.tags) ? payload.tags : [];
  const tags = tagsInput
    .map((tag) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
    .filter(Boolean);

  if (!title || !description || tags.length === 0) {
    return Response.json(
      { error: "Title, description, and at least one tag are required." },
      { status: 400 },
    );
  }

  const userComment =
    typeof payload.userComment === "string" ? payload.userComment.trim() : undefined;
  const servings =
    typeof payload.servings === "number" && Number.isFinite(payload.servings)
      ? payload.servings
      : undefined;
  const cuisine = typeof payload.cuisine === "string" ? payload.cuisine.trim() : undefined;
  const variationOf =
    typeof payload.variationOf === "string" && payload.variationOf.trim()
      ? payload.variationOf.trim()
      : payload.variationOf === null
        ? null
        : undefined;
  const isVariant = typeof payload.isVariant === "boolean" ? payload.isVariant : undefined;

  try {
    const recipeGenerationStartTime = Date.now();
    const generateOptions: GenerateRequest = {
      title,
      description,
      tags,
      userComment,
      servings,
      cuisine,
      variationOf,
      isVariant,
    };

    // Build the prompt for recipe generation
    const prompt = buildRecipeGenerationPrompt(generateOptions);

    // Get schema - exclude variationOf if we already have it (we'll override it)
    const schema = getRecipeSchema(!!generateOptions.variationOf);

    // Build prompt that explicitly requests JSON format for streaming
    // We don't use responseMimeType/responseSchema here because structured output
    // doesn't stream incrementally - it waits until JSON is complete
    const streamingPrompt = `${prompt}\n\nIMPORTANT: Respond with ONLY valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\n\nDo not include any markdown formatting, code blocks, or explanatory text. Output ONLY the raw JSON object.`;

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: streamingPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        // Don't use responseMimeType: "application/json" - it prevents incremental streaming
        // Instead, ask for JSON in the prompt and parse incrementally
        temperature: 0.6,
      },
    };

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          const llmStartTime = Date.now();
          console.log(`[LLM] Starting streaming recipe generation`, {
            operation: "streamGemini",
            model: TEXT_MODEL,
            promptLength: prompt.length,
            title: generateOptions.title,
          });

          // Stream from Gemini API
          const geminiStream = streamGemini(TEXT_MODEL, requestBody);
          const parser = new PartialJsonParser();
          let chunkCount = 0;
          let totalChunkLength = 0;

          // Process chunks as they arrive
          for await (const chunk of geminiStream) {
            chunkCount++;
            totalChunkLength += chunk.length;
            console.log(
              `[Stream] Received chunk ${chunkCount}, length: ${chunk.length}, total: ${totalChunkLength}`,
              {
                chunkPreview: chunk.substring(0, 100),
              },
            );

            // Parse the chunk and extract complete fields
            const updates = parser.processChunk(chunk);
            console.log(`[Stream] Chunk ${chunkCount} produced ${updates.length} updates`, {
              updates: updates.map((u) => (u.type === "field" ? `${u.field}` : u.type)),
            });

            // Send each update as NDJSON line
            for (const update of updates) {
              const line = JSON.stringify(update) + "\n";
              controller.enqueue(encoder.encode(line));
            }
          }

          console.log(
            `[Stream] Finished processing ${chunkCount} chunks, total length: ${totalChunkLength}`,
          );

          // Finalize parser and send any remaining field updates, followed by completion signal
          const finalUpdates = parser.finalize();
          console.log(`[Stream] Finalize produced ${finalUpdates.length} updates`, {
            updates: finalUpdates.map((u) => (u.type === "field" ? `${u.field}` : u.type)),
          });

          for (const update of finalUpdates) {
            const line = JSON.stringify(update) + "\n";
            controller.enqueue(encoder.encode(line));
          }

          const llmDuration = Date.now() - llmStartTime;
          console.log(`[LLM] Streaming recipe generation completed in ${llmDuration}ms`, {
            operation: "streamGemini",
            model: TEXT_MODEL,
            durationMs: llmDuration,
            context: "streamRecipeGeneration",
          });

          const recipeGenerationDuration = Date.now() - recipeGenerationStartTime;
          console.log(
            `[Recipe Generation] Total streaming recipe generation completed in ${recipeGenerationDuration}ms`,
            {
              operation: "generateRecipeStreamEndpoint",
              durationMs: recipeGenerationDuration,
              title,
            },
          );

          const totalEndpointDuration = Date.now() - endpointStartTime;
          console.log(
            `[API] POST /api/recipes/generate-stream completed in ${totalEndpointDuration}ms`,
            {
              operation: "generateRecipeStreamEndpoint",
              totalDurationMs: totalEndpointDuration,
              title,
            },
          );

          controller.close();
        } catch (error) {
          console.error("Failed to stream recipe generation:", error);
          try {
            const errorMessage = `Failed to stream recipe generation: ${(error as Error).message}`;
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: "error", error: errorMessage }) + "\n"),
            );
          } catch (enqueueError) {
            // Ignore errors during error handling
            console.error("Failed to enqueue error message:", enqueueError);
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Failed to generate recipe stream:", error);
    return Response.json(
      { error: `Failed to generate recipe stream: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}
