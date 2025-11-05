import { renderHook, act, waitFor } from "@testing-library/react";
import { useRecipeGeneration } from "../useRecipeGeneration";

// Mock fetch
global.fetch = jest.fn();

// Mock router
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

describe("useRecipeGeneration - Streaming", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should parse NDJSON lines correctly", async () => {
    // Mock parse endpoint response
    const parseMockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "title", "value": "Test Recipe"}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "description", "value": "A test"}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "tags", "value": ["test"]}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const parseMockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => parseMockReader),
      },
    };

    // Mock image generation endpoint (called when description is received)
    const imageMockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ url: "https://example.com/image.jpg" }),
    };

    // Mock generate endpoint response
    const generateMockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "title", "value": "Test Recipe"}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const generateMockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => generateMockReader),
      },
    };

    // Mock fetch to return parse response first, then image generation, then generate response
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(parseMockResponse)
      .mockResolvedValueOnce(imageMockResponse)
      .mockResolvedValueOnce(generateMockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test recipe", "token");
    });

    await waitFor(() => {
      expect(result.current.generatedRecipe).toBeDefined();
      expect(result.current.generatedRecipe?.title).toBe("Test Recipe");
      expect(result.current.isParsing).toBe(false);
      expect(result.current.isGenerating).toBe(false);
    });
  });

  it("should handle incomplete lines (buffer management)", async () => {
    // Mock parse endpoint
    const parseMockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "field", "field": "title"'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(', "value": "Test Recipe"}\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "description", "value": "A test"}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "tags", "value": ["test"]}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const parseMockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => parseMockReader),
      },
    };

    // Mock image generation endpoint (called when description is received)
    const imageMockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ url: "https://example.com/image.jpg" }),
    };

    // Mock generate endpoint
    const generateMockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const generateMockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => generateMockReader),
      },
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(parseMockResponse)
      .mockResolvedValueOnce(imageMockResponse)
      .mockResolvedValueOnce(generateMockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test", "token");
    });

    await waitFor(() => {
      expect(result.current.generatedRecipe?.title).toBe("Test Recipe");
    });
  });

  it("should update state incrementally on field updates", async () => {
    // Mock parse endpoint
    const parseMockReader = {
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
            '{"type": "field", "field": "description", "value": "A dish"}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "tags", "value": ["chicken"]}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const parseMockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => parseMockReader),
      },
    };

    // Mock image generation endpoint (called when description is received)
    const imageMockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ url: "https://example.com/image.jpg" }),
    };

    // Mock generate endpoint
    const generateMockReader = {
      read: jest
        .fn()
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

    const generateMockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => generateMockReader),
      },
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(parseMockResponse)
      .mockResolvedValueOnce(imageMockResponse)
      .mockResolvedValueOnce(generateMockResponse);

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
    // Mock parse endpoint
    const parseMockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "title", "value": "Test Recipe"}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "description", "value": "A test"}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "tags", "value": ["test"]}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const parseMockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => parseMockReader),
      },
    };

    // Mock image generation endpoint (called when description is received)
    const imageMockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ url: "https://example.com/image.jpg" }),
    };

    // Mock generate endpoint
    const generateMockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const generateMockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => generateMockReader),
      },
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(parseMockResponse)
      .mockResolvedValueOnce(imageMockResponse)
      .mockResolvedValueOnce(generateMockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test", "token");
    });

    await waitFor(() => {
      expect(result.current.isParsing).toBe(false);
      expect(result.current.isGenerating).toBe(false);
    });
  });

  it("should handle stream errors", async () => {
    // Mock parse endpoint with error
    const parseMockReader = {
      read: jest.fn().mockRejectedValue(new Error("Stream error")),
    };

    const parseMockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => parseMockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce(parseMockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test", "token");
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.isParsing).toBe(false);
      expect(result.current.isGenerating).toBe(false);
    });
  });

  it("should handle HTTP errors", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: jest.fn().mockResolvedValue({ error: "Server error" }),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test", "token");
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.error).toContain("500");
      expect(result.current.isParsing).toBe(false);
      expect(result.current.isGenerating).toBe(false);
    });
  });

  it("should handle multiple field updates in sequence", async () => {
    // Mock parse endpoint
    const parseMockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "title", "value": "Chicken Tikka"}\n' +
              '{"type": "field", "field": "description", "value": "A dish"}\n' +
              '{"type": "field", "field": "tags", "value": ["indian", "chicken"]}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const parseMockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => parseMockReader),
      },
    };

    // Mock image generation endpoint (called when description is received)
    const imageMockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ url: "https://example.com/image.jpg" }),
    };

    // Mock generate endpoint
    const generateMockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const generateMockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => generateMockReader),
      },
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(parseMockResponse)
      .mockResolvedValueOnce(imageMockResponse)
      .mockResolvedValueOnce(generateMockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test", "token");
    });

    await waitFor(() => {
      expect(result.current.generatedRecipe?.title).toBe("Chicken Tikka");
      expect(result.current.generatedRecipe?.tags).toEqual(["indian", "chicken"]);
      expect(result.current.isParsing).toBe(false);
      expect(result.current.isGenerating).toBe(false);
    });
  });

  it("should generate slug from title", async () => {
    // Mock parse endpoint
    const parseMockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "title", "value": "Chicken Tikka Masala"}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "description", "value": "A dish"}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "tags", "value": ["indian"]}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const parseMockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => parseMockReader),
      },
    };

    // Mock image generation endpoint (called when description is received)
    const imageMockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ url: "https://example.com/image.jpg" }),
    };

    // Mock generate endpoint
    const generateMockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const generateMockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => generateMockReader),
      },
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(parseMockResponse)
      .mockResolvedValueOnce(imageMockResponse)
      .mockResolvedValueOnce(generateMockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test", "token");
    });

    await waitFor(() => {
      expect(result.current.generatedRecipe?.slug).toBe("chicken-tikka-masala");
      expect(result.current.generatedRecipe?.name).toBe("Chicken Tikka Masala");
    });
  });

  it("should handle error type updates from stream", async () => {
    // Mock parse endpoint with error
    const parseMockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "error", "error": "Parsing failed"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const parseMockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => parseMockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce(parseMockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test", "token");
    });

    await waitFor(
      () => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error).toContain("Parsing failed");
        expect(result.current.isParsing).toBe(false);
        expect(result.current.isGenerating).toBe(false);
      },
      { timeout: 3000 },
    );
  });

  it("should handle null response body", async () => {
    const mockResponse = {
      ok: true,
      body: null,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test", "token");
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.isParsing).toBe(false);
      expect(result.current.isGenerating).toBe(false);
    });
  });

  it("should call generate endpoint after parse completes", async () => {
    // Mock parse endpoint
    const parseMockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "field", "field": "title", "value": "Test"}\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "description", "value": "A test"}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "tags", "value": ["test"]}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const parseMockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => parseMockReader),
      },
    };

    // Mock image generation endpoint (called when description is received)
    const imageMockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ url: "https://example.com/image.jpg" }),
    };

    // Mock generate endpoint
    const generateMockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            '{"type": "field", "field": "ingredients", "value": []}\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('{"type": "complete"}\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    const generateMockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => generateMockReader),
      },
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(parseMockResponse)
      .mockResolvedValueOnce(imageMockResponse)
      .mockResolvedValueOnce(generateMockResponse);

    const { result } = renderHook(() => useRecipeGeneration());

    await act(async () => {
      await result.current.generateRecipe("test", "token");
    });

    await waitFor(() => {
      // Verify all three endpoints were called: parse, image generation, and generate
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        "/api/recipes/parse-user-input-stream",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ userInput: "test" }),
        }),
      );
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        "/api/images/generate-preview",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ description: "A test" }),
        }),
      );
      expect(global.fetch).toHaveBeenNthCalledWith(
        3,
        "/api/recipes/generate-stream",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            title: "Test",
            description: "A test",
            tags: ["test"],
          }),
        }),
      );
      expect(result.current.isParsing).toBe(false);
      expect(result.current.isGenerating).toBe(false);
    });
  });
});
