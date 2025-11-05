import { streamGemini, callGemini, TEXT_MODEL } from '../gemini';

// Mock fetch globally
global.fetch = jest.fn();

describe('streamGemini', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  it('should return an async generator', async () => {
    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => ({
          read: jest.fn().mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(
              JSON.stringify({
                candidates: [{ content: { parts: [{ text: '{"title": "Chicken"}' }] } }],
              }) + '\n',
            ),
          }).mockResolvedValueOnce({
            done: true,
            value: undefined,
          }),
          releaseLock: jest.fn(),
        })),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const generator = streamGemini(TEXT_MODEL, { contents: [] });

    expect(generator).toBeDefined();
    expect(typeof generator[Symbol.asyncIterator]).toBe('function');
  });

  it('should yield text chunks from Gemini API', async () => {
    const chunks = ['{"title": "Chicken', ' Tikka', ' Masala"}'];
    let chunkIndex = 0;

    const mockReader = {
      read: jest.fn(() => {
        if (chunkIndex < chunks.length) {
          const chunkText = chunks[chunkIndex];
          return Promise.resolve({
            done: false,
            value: new TextEncoder().encode(
              JSON.stringify({
                candidates: [{ content: { parts: [{ text: chunkText }] } }],
              }) + '\n',
            ),
          });
        }
        return Promise.resolve({ done: true, value: undefined });
      }),
      releaseLock: jest.fn(),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => {
          return mockReader;
        }),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const generator = streamGemini(TEXT_MODEL, { contents: [] });
    const receivedChunks: string[] = [];

    for await (const chunk of generator) {
      receivedChunks.push(chunk);
      chunkIndex++;
    }

    expect(receivedChunks.length).toBeGreaterThan(0);
    expect(receivedChunks[0]).toContain('Chicken');
  });

  it('should handle API errors', async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: jest.fn().mockResolvedValue('Invalid request'),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const generator = streamGemini(TEXT_MODEL, { contents: [] });

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of generator) {
        // Should throw before yielding
      }
    }).rejects.toThrow();
  });

  it('should construct correct API URL', async () => {
    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => ({
          read: jest.fn().mockResolvedValue({ done: true }),
          releaseLock: jest.fn(),
        })),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    await streamGemini(TEXT_MODEL, { contents: [] }).next();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/models/${TEXT_MODEL}:streamGenerateContent`),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('should handle null response body', async () => {
    const mockResponse = {
      ok: true,
      body: null,
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const generator = streamGemini(TEXT_MODEL, { contents: [] });

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of generator) {
        // Should throw
      }
    }).rejects.toThrow('Response body is null or undefined');
  });

  it('should handle incomplete JSON lines in buffer', async () => {
    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: 'Chunk1' }] } }],
            }) + '\n{"incomplete',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            ' json": "complete"}\n' +
              JSON.stringify({
                candidates: [{ content: { parts: [{ text: 'Chunk2' }] } }],
              }) +
              '\n',
          ),
        })
        .mockResolvedValueOnce({ done: true }),
      releaseLock: jest.fn(),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => mockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const generator = streamGemini(TEXT_MODEL, { contents: [] });
    const chunks: string[] = [];

    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should handle empty text in candidates', async () => {
    const mockReader = {
      read: jest
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: '' }] } }],
            }) + '\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: 'Valid text' }] } }],
            }) + '\n',
          ),
        })
        .mockResolvedValueOnce({ done: true }),
      releaseLock: jest.fn(),
    };

    const mockResponse = {
      ok: true,
      body: {
        getReader: jest.fn(() => mockReader),
      },
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const generator = streamGemini(TEXT_MODEL, { contents: [] });
    const chunks: string[] = [];

    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    // Should only yield non-empty text
    expect(chunks).toEqual(['Valid text']);
  });
});

describe('callGemini (regression)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  it('should still work with non-streaming endpoint', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'test' }] } }],
      }),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const result = await callGemini(TEXT_MODEL, { contents: [] });

    expect(result).toBeDefined();
    expect(result.candidates).toBeDefined();
  });
});

