# Streaming Recipe Generation Implementation Plan

## Overview

Implement streaming for the `/api/recipes/generate` endpoint to enable progressive rendering of recipe data (title, description, tags) as it becomes available from the Gemini API.

## Implementation Status

**Status: Phases 0-4 Complete ✅**

- ✅ **Phase 0:** Streaming Gemini client implemented and tested
- ✅ **Phase 1:** Partial JSON parser implemented and tested
- ✅ **Phase 2:** Streaming endpoint created and tested
- ✅ **Phase 3:** Client-side streaming handler implemented and tested
- ✅ **Phase 4:** Progressive UI rendering implemented and tested
- ⏳ **Phase 5:** Error handling and polish (basic error handling implemented, additional polish pending)
- ⏳ **Phase 6:** (Optional) Cleanup and migration (not started)

**Current State:** The streaming recipe generation feature is fully functional and in use. Users can see recipe cards appear progressively as fields stream in from the Gemini API. All core functionality is implemented and tested.

**Key Files Created/Modified:**

- `src/lib/gemini.ts` - Added `streamGemini()` function
- `src/lib/partial-json-parser.ts` - New partial JSON parsing utility
- `src/app/api/recipes/generate-stream/route.ts` - New streaming endpoint
- `src/hooks/useRecipeGeneration.ts` - Updated to handle streaming responses
- `src/components/recipe-preview-card.tsx` - Updated to support partial data
- `src/components/add-recipe-modal.tsx` - Updated to show card during streaming

**Test Coverage:** All phases have comprehensive Jest test suites with 62 tests passing.

## Architecture

### Current Flow

1. Client sends request to `/api/recipes/generate`
2. API calls Gemini `generateContent` (non-streaming)
3. API waits for complete JSON response
4. API returns complete recipe object
5. Client renders complete recipe card

### New Streaming Flow

1. Client sends request to `/api/recipes/generate`
2. API calls Gemini `streamGenerateContent` (streaming)
3. API streams partial JSON chunks as they arrive
4. Client parses partial JSON incrementally
5. Client progressively updates recipe card (title → description → tags → rest)

## Implementation Steps

### 1. Backend: Add Streaming Support to Gemini Client

**File: `src/lib/gemini.ts`**

- Add `streamGemini()` function that calls Gemini's streaming endpoint
- Use `streamGenerateContent` instead of `generateContent`
- Return a `ReadableStream` that yields chunks of text as they arrive
- Handle streaming response format from Gemini API

**Key considerations:**

- Gemini streaming endpoint: `/models/{model}:streamGenerateContent`
- Response format: Server-Sent Events (SSE) or streaming JSON
- Need to extract text chunks from streaming candidates

### 2. Backend: Modify Generate Endpoint to Stream

**File: `src/app/api/recipes/generate/route.ts`**

- Change `generateRecipe()` to use streaming Gemini client
- Return a streaming response using Next.js streaming API
- Stream chunks as they arrive from Gemini
- Format chunks as newline-delimited JSON (NDJSON) or SSE format

**Stream format options:**

- **Option A: NDJSON** - Each line is a JSON object with partial recipe data

  ```json
  {"type": "partial", "field": "title", "value": "Chicken"}
  {"type": "partial", "field": "title", "value": "Chicken Tikka"}
  {"type": "complete", "field": "title", "value": "Chicken Tikka Masala"}
  {"type": "partial", "field": "summary", "value": "A classic"}
  ```

- **Option B: Raw JSON chunks** - Stream raw JSON text and let client parse

  ```
  {"title": "Chicken
  {"title": "Chicken Tikka
  {"title": "Chicken Tikka Masala", "summary": "A classic
  ```

- **Option C: SSE (Server-Sent Events)** - Standard streaming format
  ```
  data: {"type": "partial", "field": "title", "value": "Chicken"}
  data: {"type": "partial", "field": "title", "value": "Chicken Tikka"}
  ```

**Recommendation: Option A (NDJSON)** - Cleanest for parsing partial updates

### 3. Backend: Partial JSON Parser (Server-Side)

**File: `src/lib/partial-json-parser.ts` (new)**

- Create utility to parse incomplete JSON from streaming text
- Accumulate chunks and attempt to extract complete JSON values
- Handle cases where JSON is incomplete (e.g., `{"title": "Chicken` → wait for more)
- Extract complete top-level fields as they become available

**Strategy:**

- Accumulate text chunks in a buffer
- Try to parse complete JSON objects incrementally
- For partial JSON, extract what we can:
  - If we see `"title": "value"` (complete), extract it
  - If we see `"title": "incomplete...`, wait for more
- Send updates when fields become complete

### 4. Frontend: Streaming Fetch Client

**File: `src/hooks/useRecipeGeneration.ts`**

- Modify `generateRecipe()` to handle streaming response
- Use `fetch()` with `response.body.getReader()`
- Parse incoming chunks (NDJSON format)
- Update state progressively as fields arrive

**Implementation:**

```typescript
const response = await fetch("/api/recipes/generate", {
  method: "POST",
  headers: { ... },
  body: JSON.stringify({ userInput }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() || ""; // Keep incomplete line in buffer

  for (const line of lines) {
    if (!line.trim()) continue;
    const update = JSON.parse(line);
    handlePartialUpdate(update);
  }
}
```

### 5. Frontend: Partial JSON Parser (Client-Side)

**File: `src/lib/partial-json-parser.ts` (client version)**

- If using raw JSON chunks, parse incomplete JSON on client
- Extract complete fields as they arrive
- Handle edge cases (incomplete strings, arrays, objects)

**Alternative:** Use a library like `stream-json` or `jsonstream` for robust parsing

### 6. Frontend: Progressive State Updates

**File: `src/hooks/useRecipeGeneration.ts`**

- Add state for partial recipe data
- Update state incrementally as fields arrive:
  - `title` → update immediately when complete
  - `summary` → update when complete
  - `tags` → update when complete array is available
  - Other fields → update as they arrive

**State structure:**

```typescript
const [partialRecipe, setPartialRecipe] = useState<Partial<GeneratedRecipe>>({});
const [streamingComplete, setStreamingComplete] = useState(false);

// Update function
const handlePartialUpdate = (update: PartialRecipeUpdate) => {
  setPartialRecipe((prev) => ({
    ...prev,
    [update.field]: update.value,
  }));

  // Mark complete when we have title, summary, tags
  if (update.field === "tags" && Array.isArray(update.value)) {
    setStreamingComplete(true);
  }
};
```

### 7. Frontend: Progressive Rendering

**File: `src/components/recipe-preview-card.tsx`**

- Modify to accept partial recipe data
- Render fields as they become available:
  - Show title immediately when available
  - Show description when available
  - Show tags when available
  - Show skeleton/loading state for missing fields

**File: `src/components/add-recipe-modal.tsx`**

- Show recipe card during streaming (not just after completion)
- Update `RecipePreviewCard` props as partial data arrives
- Handle loading states appropriately

## JSON Parsing Strategy

### Challenge: Parsing Partial JSON

When streaming JSON, we receive incomplete text like:

```
{"title": "Chicken Tikka Masala", "summary": "A classic Indian
```

### Solution: Field-Level Streaming (Recommended)

**Approach:** Parse partial JSON on the server side and extract complete fields as they become available.

#### Server-Side Partial JSON Parser Algorithm

**File: `src/lib/partial-json-parser.ts`**

```typescript
interface FieldUpdate {
  type: "field";
  field: string;
  value: unknown;
}

interface CompleteUpdate {
  type: "complete";
}

type StreamUpdate = FieldUpdate | CompleteUpdate;

class PartialJsonParser {
  private buffer = "";
  private extractedFields = new Map<string, unknown>();
  private depth = 0;
  private inString = false;
  private escapeNext = false;
  private currentKey: string | null = null;
  private currentValueStart = -1;

  /**
   * Processes a chunk of JSON text and extracts complete fields
   */
  processChunk(chunk: string): StreamUpdate[] {
    this.buffer += chunk;
    const updates: StreamUpdate[] = [];

    // Try to extract complete fields from the buffer
    let i = 0;
    while (i < this.buffer.length) {
      const char = this.buffer[i];

      // Track string boundaries
      if (char === '"' && !this.escapeNext) {
        this.inString = !this.inString;
      }

      this.escapeNext = char === "\\" && this.inString;

      // Track object depth
      if (!this.inString) {
        if (char === "{") {
          this.depth++;
        } else if (char === "}") {
          this.depth--;

          // When we close an object, try to parse what we have
          if (this.depth === 0) {
            const jsonText = this.buffer.substring(0, i + 1);
            const parsed = this.tryParseComplete(jsonText);
            if (parsed) {
              // Extract new or updated fields
              for (const [key, value] of Object.entries(parsed)) {
                if (
                  !this.extractedFields.has(key) ||
                  JSON.stringify(this.extractedFields.get(key)) !== JSON.stringify(value)
                ) {
                  this.extractedFields.set(key, value);
                  updates.push({ type: "field", field: key, value });
                }
              }
              this.buffer = this.buffer.substring(i + 1);
              i = -1; // Reset to start of buffer
            }
          }
        }
      }

      i++;
    }

    return updates;
  }

  /**
   * Attempts to parse complete JSON from buffer
   */
  private tryParseComplete(jsonText: string): Record<string, unknown> | null {
    try {
      // Try parsing the JSON
      const parsed = JSON.parse(jsonText);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // JSON is incomplete, return null
    }
    return null;
  }

  /**
   * Marks streaming as complete
   */
  finalize(): CompleteUpdate {
    // Try one final parse of remaining buffer
    const finalUpdates = this.processChunk("");
    return { type: "complete" };
  }
}
```

#### Alternative: Simpler Regex-Based Extraction

For a simpler approach, use regex to extract complete key-value pairs:

```typescript
function extractCompleteFields(jsonText: string): Map<string, unknown> {
  const fields = new Map<string, unknown>();

  // Match complete string values: "key": "complete value"
  const stringValueRegex = /"([^"]+)":\s*"([^"]*)"(?=\s*[,}])/g;
  let match;
  while ((match = stringValueRegex.exec(jsonText)) !== null) {
    const [, key, value] = match;
    fields.set(key, value);
  }

  // Match complete arrays: "key": [complete array]
  const arrayValueRegex = /"([^"]+)":\s*(\[[^\]]*\])/g;
  while ((match = arrayValueRegex.exec(jsonText)) !== null) {
    const [, key, arrayStr] = match;
    try {
      fields.set(key, JSON.parse(arrayStr));
    } catch {
      // Array is incomplete, skip
    }
  }

  return fields;
}
```

#### Recommended Implementation Flow

1. **Server receives streaming chunks from Gemini**

   ```
   Chunk 1: {"title": "Chicken
   Chunk 2: Tikka Masala", "summary": "A classic
   Chunk 3: Indian dish", "tags": ["indian", "chicken"]
   ```

2. **Server accumulates and parses**
   - Accumulate chunks: `{"title": "Chicken Tikka Masala", "summary": "A classic Indian dish", "tags": ["indian", "chicken"]`
   - Extract complete fields using parser
   - Send updates: `{"type": "field", "field": "title", "value": "Chicken Tikka Masala"}`

3. **Client receives structured updates**
   - Parse NDJSON lines
   - Update state incrementally
   - Render fields as they arrive

### Stream Format

**NDJSON Format (recommended):**

```json
{"type": "field", "field": "title", "value": "Chicken Tikka Masala"}
{"type": "field", "field": "summary", "value": "A classic Indian dish..."}
{"type": "field", "field": "tags", "value": ["indian", "chicken", "spicy"]}
{"type": "field", "field": "servings", "value": 4}
{"type": "complete"}
```

**Benefits:**

- Clean separation of concerns
- Easy to parse on client (one JSON.parse per line)
- Server handles complexity of partial JSON parsing
- Client gets clean, structured updates

## Implementation Phases (Testable)

Each phase is independently testable and can be deployed separately. Build incrementally and validate at each step.

---

### Phase 0: Foundation - Streaming Gemini Client

**Objective:** Add streaming support to Gemini client without breaking existing functionality.

**Files to Create/Modify:**

- `src/lib/gemini.ts` - Add `streamGemini()` function
- `src/lib/__tests__/gemini.test.ts` - New test file

**Implementation:**

- Add `streamGemini()` that calls `streamGenerateContent` endpoint
- Return async generator yielding text chunks
- Keep existing `callGemini()` unchanged

**Jest Tests:**

**File: `src/lib/__tests__/gemini.test.ts`**

```typescript
import { streamGemini, callGemini, TEXT_MODEL } from "../gemini";

// Mock fetch globally
global.fetch = jest.fn();

describe("streamGemini", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-api-key";
  });

  it("should return an async generator", async () => {
    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('{"title": "Chicken"}'),
            })
            .mockResolvedValueOnce({
              done: true,
              value: undefined,
            }),
        })),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const generator = streamGemini(TEXT_MODEL, { contents: [] });

    expect(generator).toBeDefined();
    expect(typeof generator[Symbol.asyncIterator]).toBe("function");
  });

  it("should yield text chunks from Gemini API", async () => {
    const chunks = ['{"title": "Chicken', " Tikka", ' Masala"}'];
    let chunkIndex = 0;

    const mockReader = {
      read: jest.fn(() => {
        if (chunkIndex < chunks.length) {
          return Promise.resolve({
            done: false,
            value: new TextEncoder().encode(chunks[chunkIndex++]),
          });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => mockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const generator = streamGemini(TEXT_MODEL, { contents: [] });
    const receivedChunks: string[] = [];

    for await (const chunk of generator) {
      receivedChunks.push(chunk);
    }

    expect(receivedChunks).toEqual(chunks);
  });

  it("should handle API errors", async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: jest.fn().mockResolvedValue("Invalid request"),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const generator = streamGemini(TEXT_MODEL, { contents: [] });

    await expect(async () => {
      for await (const _ of generator) {
        // Should throw before yielding
      }
    }).rejects.toThrow();
  });

  it("should construct correct API URL", async () => {
    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => ({
          read: jest.fn().mockResolvedValue({ done: true }),
        })),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    await streamGemini(TEXT_MODEL, { contents: [] }).next();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/models/${TEXT_MODEL}:streamGenerateContent`),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });
});

describe("callGemini (regression)", () => {
  it("should still work with non-streaming endpoint", async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: "test" }] } }],
      }),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const result = await callGemini(TEXT_MODEL, { contents: [] });

    expect(result).toBeDefined();
    expect(result.candidates).toBeDefined();
  });
});
```

**Testing:**

- ✅ Unit test: `streamGemini()` returns async generator
- ✅ Unit test: Generator yields text chunks from Gemini API
- ✅ Unit test: Handles API errors correctly
- ✅ Unit test: Constructs correct API URL
- ✅ Regression test: Existing `callGemini()` still works

**Run Tests:**

```bash
yarn test src/lib/__tests__/gemini.test.ts
```

**Success Criteria:**

- All Jest tests pass
- Can stream text from Gemini API
- Non-streaming endpoint still works
- No breaking changes to existing code

**Rollback:** Remove `streamGemini()` function and test file, keep existing code

---

### Phase 1: Partial JSON Parser (Server-Side)

**Objective:** Create parser that extracts complete fields from partial JSON.

**Files to Create:**

- `src/lib/partial-json-parser.ts` - New file with parser implementation
- `src/lib/__tests__/partial-json-parser.test.ts` - New test file

**Implementation:**

- Implement `PartialJsonParser` class
- Add methods: `processChunk()`, `finalize()`
- Handle incomplete JSON gracefully

**Jest Tests:**

**File: `src/lib/__tests__/partial-json-parser.test.ts`**

```typescript
import { PartialJsonParser, type StreamUpdate } from "../partial-json-parser";

describe("PartialJsonParser", () => {
  let parser: PartialJsonParser;

  beforeEach(() => {
    parser = new PartialJsonParser();
  });

  describe("processChunk", () => {
    it("should parse complete JSON object", () => {
      const json = '{"title": "Chicken Tikka Masala", "summary": "A classic dish"}';
      const updates = parser.processChunk(json);

      expect(updates).toHaveLength(2);
      expect(updates[0]).toEqual({
        type: "field",
        field: "title",
        value: "Chicken Tikka Masala",
      });
      expect(updates[1]).toEqual({
        type: "field",
        field: "summary",
        value: "A classic dish",
      });
    });

    it("should extract complete fields from partial JSON", () => {
      const partialJson = '{"title": "Chicken Tikka Masala", "summary": "A classic';
      const updates = parser.processChunk(partialJson);

      // Should extract title (complete) but not summary (incomplete)
      expect(updates).toHaveLength(1);
      expect(updates[0]).toEqual({
        type: "field",
        field: "title",
        value: "Chicken Tikka Masala",
      });
    });

    it("should handle incomplete strings", () => {
      const chunk1 = '{"title": "Chicken';
      const chunk2 = ' Tikka Masala"}';

      const updates1 = parser.processChunk(chunk1);
      expect(updates1).toHaveLength(0); // No complete fields yet

      const updates2 = parser.processChunk(chunk2);
      expect(updates2).toHaveLength(1);
      expect(updates2[0].value).toBe("Chicken Tikka Masala");
    });

    it("should handle incomplete arrays", () => {
      const partialArray = '{"tags": ["indian", "chicken';
      const updates = parser.processChunk(partialArray);

      expect(updates).toHaveLength(0); // Array not complete
    });

    it("should handle complete arrays", () => {
      const completeArray = '{"tags": ["indian", "chicken", "spicy"]}';
      const updates = parser.processChunk(completeArray);

      expect(updates).toHaveLength(1);
      expect(updates[0]).toEqual({
        type: "field",
        field: "tags",
        value: ["indian", "chicken", "spicy"],
      });
    });

    it("should handle nested objects", () => {
      const nested = '{"ingredients": [{"name": "chicken", "amount": "500g"}]}';
      const updates = parser.processChunk(nested);

      expect(updates).toHaveLength(1);
      expect(updates[0].field).toBe("ingredients");
      expect(Array.isArray(updates[0].value)).toBe(true);
    });

    it("should not duplicate field updates", () => {
      const json1 = '{"title": "Chicken Tikka"}';
      const json2 = '{"title": "Chicken Tikka", "summary": "A dish"}';

      const updates1 = parser.processChunk(json1);
      const updates2 = parser.processChunk(json2);

      // Title should only appear once
      const titleUpdates = [...updates1, ...updates2].filter(
        (u) => u.type === "field" && u.field === "title",
      );
      expect(titleUpdates.length).toBeLessThanOrEqual(1);
    });

    it("should handle escaped quotes in strings", () => {
      const withEscaped = '{"title": "Chicken \\"Tikka\\" Masala"}';
      const updates = parser.processChunk(withEscaped);

      expect(updates).toHaveLength(1);
      expect(updates[0].value).toBe('Chicken "Tikka" Masala');
    });

    it("should handle incremental updates", () => {
      parser.processChunk('{"title": "Chicken"}');
      const updates = parser.processChunk('{"title": "Chicken Tikka Masala"}');

      // Should only return the updated value
      expect(updates).toHaveLength(1);
      expect(updates[0].value).toBe("Chicken Tikka Masala");
    });

    it("should handle multiple fields in chunks", () => {
      const chunk1 = '{"title": "Chicken Tikka Masala"';
      const chunk2 = ', "summary": "A classic dish"}';

      parser.processChunk(chunk1);
      const updates = parser.processChunk(chunk2);

      expect(updates.length).toBeGreaterThanOrEqual(1);
      const fields = updates
        .filter((u): u is Extract<StreamUpdate, { type: "field" }> => u.type === "field")
        .map((u) => u.field);
      expect(fields).toContain("summary");
    });
  });

  describe("finalize", () => {
    it("should return complete signal", () => {
      const result = parser.finalize();

      expect(result).toEqual({ type: "complete" });
    });

    it("should process remaining buffer on finalize", () => {
      parser.processChunk('{"title": "Chicken');
      const updates: StreamUpdate[] = [];

      // Mock processChunk to collect updates
      const originalProcess = parser.processChunk.bind(parser);
      parser.processChunk = jest.fn((chunk: string) => {
        const result = originalProcess(chunk);
        updates.push(...result);
        return result;
      });

      parser.finalize();

      // Should attempt to parse remaining buffer
      expect(parser.processChunk).toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle empty chunks", () => {
      const updates = parser.processChunk("");
      expect(updates).toHaveLength(0);
    });

    it("should handle whitespace-only chunks", () => {
      const updates = parser.processChunk("   \n\t  ");
      expect(updates).toHaveLength(0);
    });

    it("should handle malformed JSON gracefully", () => {
      const malformed = '{"title": "Chicken" invalid}';
      const updates = parser.processChunk(malformed);

      // Should not crash, may return 0 or partial results
      expect(Array.isArray(updates)).toBe(true);
    });
  });
});
```

**Testing:**

- ✅ Unit test: Parse complete JSON object
- ✅ Unit test: Parse partial JSON and extract complete fields
- ✅ Unit test: Handle incomplete strings
- ✅ Unit test: Handle incomplete arrays
- ✅ Unit test: Handle nested objects
- ✅ Unit test: Track field updates (don't duplicate)
- ✅ Unit test: Handle escaped quotes
- ✅ Unit test: Handle edge cases (empty chunks, malformed JSON)

**Run Tests:**

```bash
yarn test src/lib/__tests__/partial-json-parser.test.ts
```

**Success Criteria:**

- All Jest tests pass
- Extracts complete fields from partial JSON
- Handles edge cases (escaped quotes, nested objects, arrays)
- Returns structured updates: `{type: "field", field: string, value: unknown}`

**Rollback:** Delete file and test file, no impact on existing code

---

### Phase 2: Streaming Endpoint (Backend)

**Objective:** Add streaming endpoint alongside existing endpoint.

**Files to Modify:**

- `src/app/api/recipes/generate/route.ts` - Add streaming route handler

**Implementation Options:**

**Option A: New endpoint (safer)**

- Create `/api/recipes/generate-stream` endpoint
- Keep existing endpoint unchanged
- Test new endpoint independently

**Option B: Modify existing endpoint**

- Add query param: `?stream=true`
- Stream when param present, return JSON otherwise
- More risky but cleaner API

**Recommended: Option A** for safer incremental rollout

**Implementation:**

- Use Next.js streaming response with `ReadableStream`
- Call `streamGemini()` from Phase 0
- Use `PartialJsonParser` from Phase 1
- Format output as NDJSON

**Jest Tests:**

**File: `src/app/api/recipes/__tests__/generate-stream.test.ts`**

```typescript
import { POST } from "../generate-stream/route";
import { NextRequest } from "next/server";
import { streamGemini } from "@/lib/gemini";
import { PartialJsonParser } from "@/lib/partial-json-parser";

// Mock dependencies
jest.mock("@/lib/gemini");
jest.mock("@/lib/partial-json-parser");
jest.mock("@/lib/api-auth", () => ({
  authenticateRequest: jest.fn().mockResolvedValue({ authorized: true }),
}));

describe("POST /api/recipes/generate-stream", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return streaming response", async () => {
    // Mock streamGemini to return async generator
    const mockStream = async function* () {
      yield '{"title": "Chicken Tikka Masala"}';
      yield '{"title": "Chicken Tikka Masala", "summary": "A classic dish"}';
    };
    (streamGemini as jest.Mock).mockResolvedValue(mockStream());

    // Mock PartialJsonParser
    const mockParser = {
      processChunk: jest
        .fn()
        .mockReturnValueOnce([{ type: "field", field: "title", value: "Chicken Tikka Masala" }])
        .mockReturnValueOnce([
          { type: "field", field: "title", value: "Chicken Tikka Masala" },
          { type: "field", field: "summary", value: "A classic dish" },
        ]),
      finalize: jest.fn().mockReturnValue({ type: "complete" }),
    };
    (PartialJsonParser as jest.Mock).mockImplementation(() => mockParser);

    const request = new NextRequest("http://localhost/api/recipes/generate-stream", {
      method: "POST",
      body: JSON.stringify({ userInput: "Make chicken tikka masala" }),
    });

    const response = await POST(request);

    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
  });

  it("should send NDJSON lines", async () => {
    const mockStream = async function* () {
      yield '{"title": "Test"}';
    };
    (streamGemini as jest.Mock).mockResolvedValue(mockStream());

    const mockParser = {
      processChunk: jest.fn().mockReturnValue([{ type: "field", field: "title", value: "Test" }]),
      finalize: jest.fn().mockReturnValue({ type: "complete" }),
    };
    (PartialJsonParser as jest.Mock).mockImplementation(() => mockParser);

    const request = new NextRequest("http://localhost/api/recipes/generate-stream", {
      method: "POST",
      body: JSON.stringify({ userInput: "test" }),
    });

    const response = await POST(request);
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      }
    }

    const lines = buffer.trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);

    // Parse first line
    const firstLine = JSON.parse(lines[0]);
    expect(firstLine).toHaveProperty("type", "field");
    expect(firstLine).toHaveProperty("field", "title");
  });

  it("should include complete signal at end", async () => {
    const mockStream = async function* () {
      yield '{"title": "Test"}';
    };
    (streamGemini as jest.Mock).mockResolvedValue(mockStream());

    const mockParser = {
      processChunk: jest.fn().mockReturnValue([]),
      finalize: jest.fn().mockReturnValue({ type: "complete" }),
    };
    (PartialJsonParser as jest.Mock).mockImplementation(() => mockParser);

    const request = new NextRequest("http://localhost/api/recipes/generate-stream", {
      method: "POST",
      body: JSON.stringify({ userInput: "test" }),
    });

    const response = await POST(request);
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      }
    }

    const lines = buffer.trim().split("\n").filter(Boolean);
    const lastLine = JSON.parse(lines[lines.length - 1]);
    expect(lastLine).toEqual({ type: "complete" });
  });

  it("should handle Gemini API errors gracefully", async () => {
    (streamGemini as jest.Mock).mockRejectedValue(new Error("API Error"));

    const request = new NextRequest("http://localhost/api/recipes/generate-stream", {
      method: "POST",
      body: JSON.stringify({ userInput: "test" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toHaveProperty("error");
  });

  it("should require authentication", async () => {
    const { authenticateRequest } = require("@/lib/api-auth");
    (authenticateRequest as jest.Mock).mockResolvedValue({
      authorized: false,
      error: "Unauthorized",
    });

    const request = new NextRequest("http://localhost/api/recipes/generate-stream", {
      method: "POST",
      body: JSON.stringify({ userInput: "test" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });
});
```

**Testing:**

- ✅ Unit test: Endpoint returns streaming response
- ✅ Unit test: Stream sends NDJSON lines
- ✅ Unit test: Stream includes `{"type": "complete"}` at end
- ✅ Unit test: Handles Gemini API errors gracefully
- ✅ Unit test: Requires authentication
- ✅ Integration test: Full request → stream → parse updates
- ✅ Regression test: Non-streaming endpoint still works (if Option B)

**Run Tests:**

```bash
yarn test src/app/api/recipes/__tests__/generate-stream.test.ts
```

**Note:** For full E2E testing, consider using `@testing-library/react` and a test server, or use Next.js's built-in test utilities.

**Success Criteria:**

- Streaming endpoint returns NDJSON stream
- Stream format matches specification
- Errors handled gracefully
- Existing functionality unchanged

**Rollback:**

- Option A: Delete new endpoint
- Option B: Remove query param handling, revert to original

---

### Phase 3: Client-Side Streaming Handler

**Objective:** Update hook to handle streaming responses.

**Files to Modify:**

- `src/hooks/useRecipeGeneration.ts` - Add streaming support

**Implementation:**

- Add `generateRecipeStream()` function
- Use `response.body.getReader()` to read stream
- Parse NDJSON lines
- Update state incrementally

**Jest Tests:**

**File: `src/hooks/__tests__/useRecipeGeneration.test.ts`**

```typescript
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRecipeGeneration } from "../useRecipeGeneration";

// Mock fetch
global.fetch = jest.fn();

describe("useRecipeGeneration - Streaming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should parse NDJSON lines correctly", async () => {
    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "field", "field": "title", "value": "Test"}\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => mockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test recipe", "token");
    });

    await waitFor(() => {
      expect(result.current.generatedRecipe).toBeDefined();
      expect(result.current.generatedRecipe?.title).toBe("Test");
    });
  });

  it("should handle incomplete lines (buffer management)", async () => {
    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "field", "field": "title"'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(', "value": "Test"}\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => mockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test", "token");
    });

    await waitFor(() => {
      expect(result.current.generatedRecipe?.title).toBe("Test");
    });
  });

  it("should update state incrementally on field updates", async () => {
    const updates: Array<{ type: string; field?: string; value?: unknown }> = [];

    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "title", "value": "Chicken"}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "summary", "value": "A dish"}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => mockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test", "token");
    });

    await waitFor(() => {
      expect(result.current.generatedRecipe?.title).toBe("Chicken");
      expect(result.current.generatedRecipe?.summary).toBe("A dish");
    });
  });

  it("should handle completion signal", async () => {
    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "field", "field": "title", "value": "Test"}\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => mockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test", "token");
    });

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(false);
    });
  });

  it("should handle stream errors", async () => {
    const mockReader = {
      read: jest.fn().mockRejectedValue(new Error("Stream error")),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => mockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test", "token");
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.isGenerating).toBe(false);
    });
  });

  it("should handle HTTP errors", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValue({ error: "Server error" }),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test", "token");
    });

    await waitFor(() => {
      expect(result.current.error).toContain("Server error");
      expect(result.current.isGenerating).toBe(false);
    });
  });
});
```

**Testing:**

- ✅ Unit test: Parse NDJSON lines correctly
- ✅ Unit test: Handle incomplete lines (buffer management)
- ✅ Unit test: Update state incrementally on field updates
- ✅ Unit test: Handle completion signal
- ✅ Unit test: Handle stream errors
- ✅ Unit test: Handle HTTP errors
- ✅ Integration test: Connect to streaming endpoint (Phase 2)
- ✅ E2E test: Full flow from UI → endpoint → state update

**Run Tests:**

```bash
yarn test src/hooks/__tests__/useRecipeGeneration.test.ts
```

**Success Criteria:**

- Can read and parse streaming response
- State updates incrementally as fields arrive
- Handles errors and completion correctly
- Existing `generateRecipe()` still works (parallel implementation)

**Rollback:** Remove `generateRecipeStream()`, keep existing `generateRecipe()`

---

### Phase 4: Progressive Rendering (UI)

**Objective:** Update UI to show recipe card during streaming.

**Files to Modify:**

- `src/components/recipe-preview-card.tsx` - Support partial data
- `src/components/add-recipe-modal.tsx` - Show card during streaming

**Implementation:**

- Modify `RecipePreviewCard` to handle partial/missing fields
- Show loading skeletons for missing fields
- Update `AddRecipeModal` to use streaming generation
- Show card as soon as title is available

**Jest Tests:**

**File: `src/components/__tests__/recipe-preview-card.test.tsx`**

```typescript
import { render, screen } from '@testing-library/react';
import { RecipePreviewCard } from '../recipe-preview-card';
import type { GeneratedRecipe } from '@/types/recipes';

describe('RecipePreviewCard', () => {
  const mockRecipe: GeneratedRecipe = {
    slug: 'test-recipe',
    name: 'Test Recipe',
    description: 'A test recipe',
    tags: ['test', 'recipe'],
    image_url: null,
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    title: 'Test Recipe',
    summary: 'A test recipe',
    ingredients: [],
    instructions: [],
    servings: 4,
  };

  it('should render title when available', () => {
    render(<RecipePreviewCard recipe={mockRecipe} />);
    expect(screen.getByText('Test Recipe')).toBeInTheDocument();
  });

  it('should render description when available', () => {
    render(<RecipePreviewCard recipe={mockRecipe} />);
    expect(screen.getByText('A test recipe')).toBeInTheDocument();
  });

  it('should render tags when available', () => {
    render(<RecipePreviewCard recipe={mockRecipe} />);
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('recipe')).toBeInTheDocument();
  });

  it('should handle missing description gracefully', () => {
    const recipeWithoutDesc = { ...mockRecipe, description: null, summary: null };
    render(<RecipePreviewCard recipe={recipeWithoutDesc} />);
    expect(screen.getByText('Test Recipe')).toBeInTheDocument();
  });

  it('should handle empty tags array', () => {
    const recipeWithoutTags = { ...mockRecipe, tags: [] };
    render(<RecipePreviewCard recipe={recipeWithoutTags} />);
    expect(screen.getByText('Test Recipe')).toBeInTheDocument();
  });

  it('should show loading state for missing image', () => {
    const recipeWithoutImage = { ...mockRecipe, image_url: null };
    render(<RecipePreviewCard recipe={recipeWithoutImage} />);
    // Check for loading/skeleton state
    const imageContainer = screen.getByRole('img', { hidden: true }).closest('figure');
    expect(imageContainer).toBeInTheDocument();
  });
});
```

**File: `src/components/__tests__/add-recipe-modal.test.tsx`**

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AddRecipeModal } from '../add-recipe-modal';
import { useRecipeGeneration } from '@/hooks/useRecipeGeneration';
import { useAuth } from '@/hooks/useAuth';

// Mock hooks
jest.mock('@/hooks/useRecipeGeneration');
jest.mock('@/hooks/useAuth');
jest.mock('@/hooks/useSessionToken');

describe('AddRecipeModal - Streaming', () => {
  const mockGenerateRecipe = jest.fn();
  const mockReset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      session: { user: { id: 'test-user' } },
      loading: false,
    });
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      generatedRecipe: null,
      isGenerating: false,
      isAdding: false,
      error: null,
      generateRecipe: mockGenerateRecipe,
      reset: mockReset,
      setError: jest.fn(),
    });
  });

  it('should show recipe card when title is received', async () => {
    const { rerender } = render(<AddRecipeModal isOpen={true} onClose={jest.fn()} />);

    // Simulate streaming update with title
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      generatedRecipe: {
        slug: 'test',
        name: 'Test Recipe',
        description: null,
        tags: [],
        title: 'Test Recipe',
        summary: null,
        ingredients: [],
        instructions: [],
      },
      isGenerating: true, // Still generating
      isAdding: false,
      error: null,
      generateRecipe: mockGenerateRecipe,
      reset: mockReset,
      setError: jest.fn(),
    });

    rerender(<AddRecipeModal isOpen={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Test Recipe')).toBeInTheDocument();
    });
  });

  it('should disable "Add recipe" button until complete', async () => {
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      generatedRecipe: {
        slug: 'test',
        name: 'Test Recipe',
        title: 'Test Recipe',
        // Missing required fields
      },
      isGenerating: true,
      isAdding: false,
      error: null,
      generateRecipe: mockGenerateRecipe,
      reset: mockReset,
      setError: jest.fn(),
    });

    render(<AddRecipeModal isOpen={true} onClose={jest.fn()} />);

    const addButton = screen.getByRole('button', { name: /add recipe/i });
    expect(addButton).toBeDisabled();
  });

  it('should enable "Add recipe" button when complete', async () => {
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      generatedRecipe: {
        slug: 'test',
        name: 'Test Recipe',
        title: 'Test Recipe',
        summary: 'A test',
        tags: ['test'],
        ingredients: [],
        instructions: [],
      },
      isGenerating: false, // Complete
      isAdding: false,
      error: null,
      generateRecipe: mockGenerateRecipe,
      reset: mockReset,
      setError: jest.fn(),
    });

    render(<AddRecipeModal isOpen={true} onClose={jest.fn()} />);

    const addButton = screen.getByRole('button', { name: /add recipe/i });
    expect(addButton).not.toBeDisabled();
  });

  it('should show loading indicator during generation', () => {
    (useRecipeGeneration as jest.Mock).mockReturnValue({
      generatedRecipe: null,
      isGenerating: true,
      isAdding: false,
      error: null,
      generateRecipe: mockGenerateRecipe,
      reset: mockReset,
      setError: jest.fn(),
    });

    render(<AddRecipeModal isOpen={true} onClose={jest.fn()} />);

    // Check for loading state in form
    expect(screen.getByRole('button', { name: /generating/i })).toBeDisabled();
  });
});
```

**Testing:**

- ✅ Unit test: Card renders title when available
- ✅ Unit test: Card renders description when available
- ✅ Unit test: Card renders tags when available
- ✅ Unit test: Card handles missing fields gracefully
- ✅ Unit test: Modal shows card when title received
- ✅ Unit test: "Add recipe" button disabled until complete
- ✅ Unit test: Loading indicators shown during generation
- ✅ Visual test: Progressive updates (manual testing)
- ✅ E2E test: Full user flow (submit → see progressive updates → add recipe)

**Run Tests:**

```bash
yarn test src/components/__tests__/recipe-preview-card.test.tsx
yarn test src/components/__tests__/add-recipe-modal.test.tsx
```

**Success Criteria:**

- Recipe card renders progressively
- Missing fields show appropriate loading states
- UX feels responsive and smooth
- "Add recipe" only enabled when complete

**Rollback:** Revert to showing card only after complete response

---

### Phase 5: Integration & Polish

**Objective:** Full integration, error handling, and optimizations.

**Files to Modify:**

- All previous files - Add error handling, optimizations
- `src/components/add-recipe-modal.tsx` - Error states
- `src/hooks/useRecipeGeneration.ts` - Fallback logic

**Implementation:**

- Add fallback to non-streaming if streaming fails
- Add error boundaries and retry logic
- Optimize rendering (debounce rapid updates if needed)
- Add loading indicators
- Handle edge cases (network drops, malformed data)

**Jest Tests:**

**File: `src/hooks/__tests__/useRecipeGeneration-fallback.test.ts`**

```typescript
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRecipeGeneration } from "../useRecipeGeneration";

global.fetch = jest.fn();

describe("useRecipeGeneration - Fallback Behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fallback to non-streaming if streaming fails", async () => {
    // Mock streaming endpoint failure
    const mockStreamError = {
      ok: false,
      status: 500,
      json: jest.fn().mockResolvedValue({ error: "Streaming unavailable" }),
    };

    // Mock non-streaming endpoint success
    const mockNonStreamResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        recipe: {
          slug: "test",
          name: "Test Recipe",
          title: "Test Recipe",
          summary: "A test",
          tags: ["test"],
          ingredients: [],
          instructions: [],
        },
      }),
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockStreamError) // Streaming fails
      .mockResolvedValueOnce(mockNonStreamResponse); // Fallback succeeds

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test", "token");
    });

    await waitFor(() => {
      expect(result.current.generatedRecipe).toBeDefined();
      expect(result.current.generatedRecipe?.title).toBe("Test Recipe");
    });
  });

  it("should handle network interruption gracefully", async () => {
    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "field", "field": "title", "value": "Test"}\n'),
        })
        .mockRejectedValueOnce(new Error("Network error")),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => mockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test", "token");
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.isGenerating).toBe(false);
    });
  });

  it("should handle malformed JSON gracefully", async () => {
    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"invalid": json}\n'), // Malformed
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => mockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test", "token");
    });

    // Should handle error or skip malformed line
    await waitFor(() => {
      expect(result.current.isGenerating).toBe(false);
    });
  });
});
```

**Performance Tests:**

**File: `src/lib/__tests__/partial-json-parser.performance.test.ts`**

```typescript
import { PartialJsonParser } from "../partial-json-parser";

describe("PartialJsonParser - Performance", () => {
  it("should handle large JSON efficiently", () => {
    const parser = new PartialJsonParser();
    const largeJson = JSON.stringify({
      title: "Test",
      summary: "A".repeat(10000), // Large string
      ingredients: Array.from({ length: 100 }, (_, i) => ({
        name: `ingredient-${i}`,
        amount: "1 cup",
      })),
    });

    const start = performance.now();
    parser.processChunk(largeJson);
    const end = performance.now();

    // Should complete in reasonable time (< 100ms)
    expect(end - start).toBeLessThan(100);
  });

  it("should handle rapid incremental updates", () => {
    const parser = new PartialJsonParser();
    const chunks = ['{"title": "Chicken', " Tikka", ' Masala"}'];

    const start = performance.now();
    chunks.forEach((chunk) => parser.processChunk(chunk));
    const end = performance.now();

    // Should handle rapid updates efficiently
    expect(end - start).toBeLessThan(50);
  });
});
```

**Testing:**

- ✅ Unit test: Streaming fails → falls back to non-streaming
- ✅ Unit test: Network interruption handled gracefully
- ✅ Unit test: Malformed JSON handled gracefully
- ✅ Performance test: Large JSON handled efficiently
- ✅ Performance test: Rapid updates handled efficiently
- ✅ Visual test: Loading states clear and informative (manual)
- ✅ E2E test: All user flows work correctly

**Run Tests:**

```bash
yarn test src/hooks/__tests__/useRecipeGeneration-fallback.test.ts
yarn test src/lib/__tests__/partial-json-parser.performance.test.ts
```

**Success Criteria:**

- Robust error handling
- Graceful degradation
- Good UX with clear feedback
- No performance issues

**Rollback:** Can disable streaming via feature flag or revert to previous phase

---

### Phase 6: Cleanup & Migration (Optional)

**Objective:** Migrate fully to streaming, remove old code.

**Files to Modify:**

- `src/hooks/useRecipeGeneration.ts` - Remove non-streaming code
- `src/app/api/recipes/generate/route.ts` - Remove non-streaming endpoint (if Option A)

**Implementation:**

- Replace `generateRecipe()` with streaming version
- Remove duplicate code
- Update all call sites
- Remove old endpoints if using Option A

**Testing:**

- ✅ Regression test: All existing tests pass
- ✅ E2E test: All user flows work
- ✅ Performance test: No regressions

**Success Criteria:**

- Codebase simplified
- All functionality preserved
- No breaking changes for users

**Rollback:** Revert commit, restore previous implementation

---

## Phase Dependencies

```
Phase 0 (Gemini Client)
  ↓
Phase 1 (JSON Parser) ──┐
  ↓                     │
Phase 2 (Endpoint) ─────┼──→ Phase 3 (Client Handler)
                        │          ↓
                        └──────────┼──→ Phase 4 (UI)
                                   │       ↓
                                   └───────┼──→ Phase 5 (Polish)
                                           │       ↓
                                           └───────┼──→ Phase 6 (Cleanup)
```

## Testing Strategy Per Phase

### Jest Test Structure

**Test File Organization:**

```
src/
  lib/
    __tests__/
      gemini.test.ts
      partial-json-parser.test.ts
      partial-json-parser.performance.test.ts
  hooks/
    __tests__/
      useRecipeGeneration.test.ts
      useRecipeGeneration-fallback.test.ts
  components/
    __tests__/
      recipe-preview-card.test.tsx
      add-recipe-modal.test.tsx
  app/
    api/
      recipes/
        __tests__/
          generate-stream.test.ts
```

### Unit Tests (Jest)

- Test individual functions/components in isolation
- Mock dependencies (Gemini API, stream readers, fetch)
- Test edge cases and error conditions
- Use `@testing-library/react` for React components
- Use `jest.fn()` and `jest.mock()` for mocking

### Integration Tests (Jest)

- Test components working together
- Mock API endpoints with `fetch` mocks
- Verify data flow between layers
- Use `waitFor` for async state updates

### E2E Tests (Manual + Jest)

- Manual testing for visual validation
- Jest tests for critical user flows
- Use real endpoints or comprehensive mocks
- Verify UI updates correctly

### Test Utilities

**File: `src/test/utils/stream-helpers.ts`**

```typescript
/**
 * Helper to create mock ReadableStream for testing
 */
export function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  let index = 0;

  return new ReadableStream({
    async pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(new TextEncoder().encode(chunks[index++]));
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Helper to read stream in tests
 */
export async function readStream(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value, { stream: true }));
  }

  return chunks;
}
```

### Running Tests

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run specific test file
yarn test src/lib/__tests__/partial-json-parser.test.ts

# Run tests with coverage
yarn test --coverage

# Run tests matching pattern
yarn test --testNamePattern="streaming"
```

### Manual Testing Checklist

- [ ] Stream works on fast network
- [ ] Stream works on slow network (throttle in DevTools)
- [ ] Stream handles connection drops
- [ ] UI updates smoothly
- [ ] Error states clear
- [ ] Fallback works if streaming fails

---

## Quick Phase Reference

| Phase | Name           | Testability              | Risk   | Duration Estimate |
| ----- | -------------- | ------------------------ | ------ | ----------------- |
| 0     | Gemini Client  | High (isolated)          | Low    | 2-4 hours         |
| 1     | JSON Parser    | High (pure function)     | Low    | 4-6 hours         |
| 2     | Endpoint       | Medium (needs Phase 0+1) | Medium | 4-6 hours         |
| 3     | Client Handler | Medium (needs Phase 2)   | Medium | 3-5 hours         |
| 4     | UI Rendering   | High (visual validation) | Low    | 3-4 hours         |
| 5     | Polish         | Medium (integration)     | Low    | 4-6 hours         |
| 6     | Cleanup        | High (refactor only)     | Low    | 2-3 hours         |

**Total Estimated Time:** 22-32 hours

### Phase Completion Checklist

- [x] **Phase 0:** Streaming Gemini client implemented and tested ✅
- [x] **Phase 1:** Partial JSON parser implemented and tested ✅
- [x] **Phase 2:** Streaming endpoint created and tested ✅
- [x] **Phase 3:** Client-side streaming handler implemented and tested ✅
- [x] **Phase 4:** Progressive UI rendering implemented and tested ✅
- [x] **Phase 5:** Error handling and polish completed ✅ (basic error handling implemented, console suppression added)
- [ ] **Phase 6:** (Optional) Cleanup and migration completed (not needed - new endpoint approach used)

### Deployment Strategy

**Recommended:** Deploy phases incrementally

- Phase 0-1: Deploy together (foundation)
- Phase 2: Deploy behind feature flag or new endpoint
- Phase 3-4: Deploy together (full streaming capability)
- Phase 5: Deploy polish and fixes
- Phase 6: Deploy cleanup when confident

**Feature Flag Approach:**

```typescript
// Enable streaming via environment variable or config
const USE_STREAMING = process.env.ENABLE_RECIPE_STREAMING === 'true';

if (USE_STREAMING) {
  return generateRecipeStream(...);
} else {
  return generateRecipe(...);
}
```

## Technical Considerations

### Error Handling

- Handle incomplete JSON gracefully
- Handle network errors during streaming
- Provide fallback to non-streaming mode if streaming fails

### Performance

- Streaming reduces perceived latency
- Progressive rendering improves UX
- Consider debouncing rapid updates

### Testing

- Test with slow network conditions
- Test with partial JSON chunks
- Test error scenarios (connection drops, malformed JSON)

## Example Stream Format

**Server sends (NDJSON):**

```json
{"type": "field", "field": "title", "value": "Chicken Tikka Masala"}
{"type": "field", "field": "summary", "value": "A classic Indian dish..."}
{"type": "field", "field": "tags", "value": ["indian", "chicken", "spicy"]}
{"type": "field", "field": "ingredients", "value": [...]}
{"type": "complete"}
```

**Client receives and updates:**

- Receives title → renders title immediately
- Receives summary → renders description
- Receives tags → renders tags
- Receives complete → enables "Add recipe" button

## Files to Modify/Create

### New Files:

- `src/lib/partial-json-parser.ts` - Server-side partial JSON parsing
- `src/lib/streaming-json-parser.ts` - Client-side streaming JSON parser (if needed)

### Modified Files:

- `src/lib/gemini.ts` - Add `streamGemini()` function
- `src/app/api/recipes/generate/route.ts` - Add streaming endpoint
- `src/hooks/useRecipeGeneration.ts` - Handle streaming responses
- `src/components/recipe-preview-card.tsx` - Support partial data
- `src/components/add-recipe-modal.tsx` - Show card during streaming

## Complete Example Flow

### Step-by-Step Execution

**1. User submits recipe request:**

```typescript
// Client: add-recipe-modal.tsx
await generateRecipe("Make me chicken tikka masala", accessToken);
```

**2. Client initiates streaming request:**

```typescript
// Client: useRecipeGeneration.ts
const response = await fetch("/api/recipes/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({ userInput: "Make me chicken tikka masala" }),
});

// Start reading stream
const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (!line.trim()) continue;
    const update = JSON.parse(line);
    handleStreamUpdate(update);
  }
}
```

**3. Server receives request and starts streaming:**

```typescript
// Server: route.ts
export async function POST(request: NextRequest) {
  // ... auth, validation ...

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Start streaming from Gemini
      const geminiStream = await streamGemini(TEXT_MODEL, requestBody);
      const parser = new PartialJsonParser();

      for await (const chunk of geminiStream) {
        const updates = parser.processChunk(chunk);

        for (const update of updates) {
          const line = JSON.stringify(update) + "\n";
          controller.enqueue(encoder.encode(line));
        }
      }

      // Send completion signal
      controller.enqueue(encoder.encode(JSON.stringify({ type: "complete" }) + "\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

**4. Client receives and processes updates:**

```typescript
// Client: useRecipeGeneration.ts
function handleStreamUpdate(update: StreamUpdate) {
  if (update.type === "field") {
    setPartialRecipe((prev) => ({
      ...prev,
      [update.field]: update.value,
    }));

    // Show card as soon as we have title
    if (update.field === "title" && !generatedRecipe) {
      setGeneratedRecipe({
        slug: slugify(update.value as string),
        name: update.value as string,
        description: null,
        tags: [],
        // ... other fields default to null/empty
      });
    }
  } else if (update.type === "complete") {
    setIsGenerating(false);
    // Enable "Add recipe" button
  }
}
```

**5. UI updates progressively:**

```typescript
// Client: add-recipe-modal.tsx
{partialRecipe && (
  <RecipePreviewCard
    recipe={{
      ...partialRecipe,
      // Merge with defaults for missing fields
      description: partialRecipe.description || null,
      tags: partialRecipe.tags || [],
    }}
  />
)}
```

### Timeline Visualization

```
Time →
Server:  [Gemini Stream] → [Parse JSON] → [Extract Fields] → [Send Updates]
Client:  [Receive] → [Parse NDJSON] → [Update State] → [Render]
UI:      [Loading...] → [Title] → [Title + Description] → [Title + Desc + Tags] → [Complete]
```

**Example timing:**

- T+0ms: Request sent
- T+200ms: Title received → UI shows title
- T+500ms: Summary received → UI shows title + description
- T+800ms: Tags received → UI shows title + description + tags
- T+2000ms: Complete → All fields available, "Add recipe" enabled

## References

- Gemini API Streaming: https://ai.google.dev/gemini-api/docs/streaming
- Next.js Streaming: https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming
- Fetch API Streaming: https://developer.mozilla.org/en-US/docs/Web/API/Streams_API
- NDJSON Format: https://github.com/ndjson/ndjson-spec
