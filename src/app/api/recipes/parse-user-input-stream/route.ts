import { type NextRequest } from "next/server";
import { streamGemini, TEXT_MODEL } from "@/lib/gemini";
import {
  buildUserInputParsingPrompt,
  userInputParsingSchema,
} from "@/lib/prompts/user-input-parsing";
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
  const userInput = typeof payload.userInput === "string" ? payload.userInput.trim() : undefined;

  if (!userInput) {
    return Response.json({ error: "userInput is required" }, { status: 400 });
  }

  try {
    const parseStartTime = Date.now();
    const parsePrompt = buildUserInputParsingPrompt(userInput);

    // Build prompt that explicitly requests JSON format for streaming
    // We don't use responseMimeType/responseSchema here because structured output
    // doesn't stream incrementally - it waits until JSON is complete
    const streamingPrompt = `${parsePrompt}\n\nIMPORTANT: Respond with ONLY valid JSON matching this schema:\n${JSON.stringify(userInputParsingSchema, null, 2)}\n\nDo not include any markdown formatting, code blocks, or explanatory text. Output ONLY the raw JSON object.`;

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
        temperature: 0.3,
      },
    };

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          const llmStartTime = Date.now();
          console.log(`[LLM] Starting streaming user input parsing`, {
            operation: "streamGemini",
            model: TEXT_MODEL,
            promptLength: streamingPrompt.length,
            userInputLength: userInput.length,
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
              `[Parse Stream] Received chunk ${chunkCount}, length: ${chunk.length}, total: ${totalChunkLength}`,
              {
                chunkPreview: chunk.substring(0, 100),
              },
            );

            // Parse the chunk and extract complete fields
            const updates = parser.processChunk(chunk);
            console.log(`[Parse Stream] Chunk ${chunkCount} produced ${updates.length} updates`, {
              updates: updates.map((u) => (u.type === "field" ? `${u.field}` : u.type)),
            });

            // Send each update as NDJSON line
            for (const update of updates) {
              const line = JSON.stringify(update) + "\n";
              controller.enqueue(encoder.encode(line));
            }
          }

          console.log(
            `[Parse Stream] Finished processing ${chunkCount} chunks, total length: ${totalChunkLength}`,
          );

          // Finalize parser and send any remaining field updates, followed by completion signal
          const finalUpdates = parser.finalize();
          console.log(`[Parse Stream] Finalize produced ${finalUpdates.length} updates`, {
            updates: finalUpdates.map((u) => (u.type === "field" ? `${u.field}` : u.type)),
          });

          for (const update of finalUpdates) {
            const line = JSON.stringify(update) + "\n";
            controller.enqueue(encoder.encode(line));
          }

          const llmDuration = Date.now() - llmStartTime;
          console.log(`[LLM] Streaming user input parsing completed in ${llmDuration}ms`, {
            operation: "streamGemini",
            model: TEXT_MODEL,
            durationMs: llmDuration,
            context: "parseUserInput",
          });

          const parseDuration = Date.now() - parseStartTime;
          console.log(
            `[User Input Parsing] Total streaming parsing completed in ${parseDuration}ms`,
            {
              operation: "parseUserInputStreamEndpoint",
              durationMs: parseDuration,
              userInputLength: userInput.length,
            },
          );

          const totalEndpointDuration = Date.now() - endpointStartTime;
          console.log(
            `[API] POST /api/recipes/parse-user-input-stream completed in ${totalEndpointDuration}ms`,
            {
              operation: "parseUserInputStreamEndpoint",
              totalDurationMs: totalEndpointDuration,
              userInputLength: userInput.length,
            },
          );

          controller.close();
        } catch (error) {
          console.error("Failed to stream user input parsing:", error);
          try {
            const errorMessage = `Failed to stream user input parsing: ${(error as Error).message}`;
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
    console.error("Failed to generate parse stream:", error);
    return Response.json(
      { error: `Failed to generate parse stream: ${(error as Error).message}` },
      { status: 500 },
    );
  }
}
