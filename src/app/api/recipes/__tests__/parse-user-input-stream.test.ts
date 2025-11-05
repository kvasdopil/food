/**
 * @jest-environment node
 */

import { POST } from '../parse-user-input-stream/route';
import { NextRequest } from 'next/server';
import { streamGemini } from '@/lib/gemini';
import { PartialJsonParser } from '@/lib/partial-json-parser';
import { authenticateRequest } from '@/lib/api-auth';

// Mock dependencies
jest.mock('@/lib/gemini', () => ({
  streamGemini: jest.fn(),
  TEXT_MODEL: 'gemini-2.5-flash',
}));
jest.mock('@/lib/partial-json-parser');
jest.mock('@/lib/api-auth', () => ({
  authenticateRequest: jest.fn(),
}));

describe('POST /api/recipes/parse-user-input-stream', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset authenticateRequest to return authorized by default
    (authenticateRequest as jest.Mock).mockResolvedValue({ authorized: true });
    // Suppress console logs during tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(async () => {
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    // Give time for any pending async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  it('should return streaming response', async () => {
    // Mock streamGemini to return async generator that properly terminates
    const mockStream = async function* () {
      yield '{"title": "Chicken Tikka Masala"}';
      yield '{"title": "Chicken Tikka Masala", "description": "A classic dish"}';
      // Generator completes naturally when no more yields
    };
    (streamGemini as jest.Mock).mockReturnValue(mockStream());

    // Mock PartialJsonParser
    const mockParser = {
      processChunk: jest
        .fn()
        .mockReturnValueOnce([{ type: 'field', field: 'title', value: 'Chicken Tikka Masala' }])
        .mockReturnValueOnce([
          { type: 'field', field: 'title', value: 'Chicken Tikka Masala' },
          { type: 'field', field: 'description', value: 'A classic dish' },
        ]),
      finalize: jest.fn().mockReturnValue([{ type: 'complete' }]),
    };
    (PartialJsonParser as jest.Mock).mockImplementation(() => mockParser);

    const request = new NextRequest('http://localhost/api/recipes/parse-user-input-stream', {
      method: 'POST',
      body: JSON.stringify({ userInput: 'Make chicken tikka masala' }),
    });

    const response = await POST(request);

    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');

    // Consume and close the stream to prevent memory leaks
    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } finally {
        reader.releaseLock();
      }
    }
  });

  it('should send NDJSON lines', async () => {
    const mockStream = async function* () {
      yield '{"title": "Test"}';
      // Generator completes naturally
    };
    (streamGemini as jest.Mock).mockReturnValue(mockStream());

    const mockParser = {
      processChunk: jest.fn().mockReturnValue([
        { type: 'field', field: 'title', value: 'Test' },
      ]),
      finalize: jest.fn().mockReturnValue([{ type: 'complete' }]),
    };
    (PartialJsonParser as jest.Mock).mockImplementation(() => mockParser);

    const request = new NextRequest('http://localhost/api/recipes/parse-user-input-stream', {
      method: 'POST',
      body: JSON.stringify({ userInput: 'test' }),
    });

    const response = await POST(request);
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
        }
      } finally {
        reader.releaseLock();
      }
    }

    const lines = buffer.trim().split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);

    // Parse first line
    const firstLine = JSON.parse(lines[0]);
    expect(firstLine).toHaveProperty('type', 'field');
    expect(firstLine).toHaveProperty('field', 'title');
  });

  it('should include complete signal at end', async () => {
    const mockStream = async function* () {
      yield '{"title": "Test"}';
      // Generator completes naturally
    };
    (streamGemini as jest.Mock).mockReturnValue(mockStream());

    const mockParser = {
      processChunk: jest.fn().mockReturnValue([]),
      finalize: jest.fn().mockReturnValue([{ type: 'complete' }]),
    };
    (PartialJsonParser as jest.Mock).mockImplementation(() => mockParser);

    const request = new NextRequest('http://localhost/api/recipes/parse-user-input-stream', {
      method: 'POST',
      body: JSON.stringify({ userInput: 'test' }),
    });

    const response = await POST(request);
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
        }
      } finally {
        reader.releaseLock();
      }
    }

    const lines = buffer.trim().split('\n').filter(Boolean);
    const lastLine = JSON.parse(lines[lines.length - 1]);
    expect(lastLine).toEqual({ type: 'complete' });
  });

  it('should handle Gemini API errors gracefully', async () => {
    // Mock streamGemini to throw an error when called
    (streamGemini as jest.Mock).mockImplementation(() => {
      return (async function* () {
        throw new Error('API Error');
      })();
    });

    const request = new NextRequest('http://localhost/api/recipes/parse-user-input-stream', {
      method: 'POST',
      body: JSON.stringify({ userInput: 'test' }),
    });

    const response = await POST(request);

    // For streaming errors, check the stream contains error
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
        }
      } finally {
        reader.releaseLock();
      }

      const lines = buffer.trim().split('\n').filter(Boolean);
      if (lines.length > 0) {
        const lastLine = JSON.parse(lines[lines.length - 1]);
        expect(lastLine).toHaveProperty('error');
      }
    }
  });

  it('should require authentication', async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue({
      authorized: false,
      error: 'Unauthorized',
    });

    const request = new NextRequest('http://localhost/api/recipes/parse-user-input-stream', {
      method: 'POST',
      body: JSON.stringify({ userInput: 'test' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('should require userInput', async () => {
    const request = new NextRequest('http://localhost/api/recipes/parse-user-input-stream', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  // Note: Testing invalid JSON and missing fields is complex with NextRequest
  // These scenarios are covered by integration/E2E tests
  // The core streaming functionality is tested above
});

