import { PartialJsonParser, type StreamUpdate } from '../partial-json-parser';

describe('PartialJsonParser', () => {
  let parser: PartialJsonParser;

  beforeEach(() => {
    parser = new PartialJsonParser();
  });

  describe('processChunk', () => {
    it('should parse complete JSON object', () => {
      const json = '{"title": "Chicken Tikka Masala", "summary": "A classic dish"}';
      const updates = parser.processChunk(json);

      expect(updates).toHaveLength(2);
      expect(updates[0]).toEqual({
        type: 'field',
        field: 'title',
        value: 'Chicken Tikka Masala',
      });
      expect(updates[1]).toEqual({
        type: 'field',
        field: 'summary',
        value: 'A classic dish',
      });
    });

    it('should extract complete fields from partial JSON', () => {
      const partialJson = '{"title": "Chicken Tikka Masala", "summary": "A classic';
      const updates = parser.processChunk(partialJson);

      // Should extract title (complete) but not summary (incomplete)
      expect(updates.length).toBeGreaterThanOrEqual(1);
      const titleUpdate = updates.find((u) => u.type === 'field' && u.field === 'title');
      expect(titleUpdate).toBeDefined();
      if (titleUpdate && titleUpdate.type === 'field') {
        expect(titleUpdate.value).toBe('Chicken Tikka Masala');
      }
    });

    it('should handle incomplete strings', () => {
      const chunk1 = '{"title": "Chicken';
      const chunk2 = ' Tikka Masala"}';

      const updates1 = parser.processChunk(chunk1);
      expect(updates1).toHaveLength(0); // No complete fields yet

      const updates2 = parser.processChunk(chunk2);
      expect(updates2).toHaveLength(1);
      if (updates2[0] && updates2[0].type === 'field') {
        expect(updates2[0].value).toBe('Chicken Tikka Masala');
      }
    });

    it('should handle incomplete arrays', () => {
      const partialArray = '{"tags": ["indian", "chicken';
      const updates = parser.processChunk(partialArray);

      expect(updates).toHaveLength(0); // Array not complete
    });

    it('should handle complete arrays', () => {
      const completeArray = '{"tags": ["indian", "chicken", "spicy"]}';
      const updates = parser.processChunk(completeArray);

      expect(updates).toHaveLength(1);
      expect(updates[0]).toEqual({
        type: 'field',
        field: 'tags',
        value: ['indian', 'chicken', 'spicy'],
      });
    });

    it('should handle nested objects', () => {
      const nested = '{"ingredients": [{"name": "chicken", "amount": "500g"}]}';
      const updates = parser.processChunk(nested);

      expect(updates).toHaveLength(1);
      expect(updates[0].type).toBe('field');
      if (updates[0].type === 'field') {
        expect(updates[0].field).toBe('ingredients');
        expect(Array.isArray(updates[0].value)).toBe(true);
      }
    });

    it('should not duplicate field updates', () => {
      const json1 = '{"title": "Chicken Tikka"}';
      const json2 = '{"title": "Chicken Tikka", "summary": "A dish"}';

      const updates1 = parser.processChunk(json1);
      const updates2 = parser.processChunk(json2);

      // Title should only appear in first update
      const titleUpdates1 = updates1.filter(
        (u) => u.type === 'field' && u.field === 'title',
      );
      const titleUpdates2 = updates2.filter(
        (u) => u.type === 'field' && u.field === 'title',
      );

      expect(titleUpdates1.length).toBe(1);
      expect(titleUpdates2.length).toBe(0); // Should not duplicate
    });

    it('should handle escaped quotes in strings', () => {
      const withEscaped = '{"title": "Chicken \\"Tikka\\" Masala"}';
      const updates = parser.processChunk(withEscaped);

      expect(updates).toHaveLength(1);
      if (updates[0] && updates[0].type === 'field') {
        expect(updates[0].value).toBe('Chicken "Tikka" Masala');
      }
    });

    it('should handle incremental updates', () => {
      parser.processChunk('{"title": "Chicken"}');
      const updates = parser.processChunk('{"title": "Chicken Tikka Masala"}');

      // Should return the updated value
      expect(updates.length).toBeGreaterThanOrEqual(0);
      // If title changed, we'll get an update; if same, no update
      const titleUpdate = updates.find((u) => u.type === 'field' && u.field === 'title');
      if (titleUpdate && titleUpdate.type === 'field') {
        expect(titleUpdate.value).toBe('Chicken Tikka Masala');
      }
    });

    it('should handle multiple fields in chunks', () => {
      const chunk1 = '{"title": "Chicken Tikka Masala"';
      const chunk2 = ', "summary": "A classic dish"}';

      parser.processChunk(chunk1);
      const updates = parser.processChunk(chunk2);

      expect(updates.length).toBeGreaterThanOrEqual(1);
      const fields = updates
        .filter((u): u is Extract<StreamUpdate, { type: 'field' }> => u.type === 'field')
        .map((u) => u.field);
      expect(fields).toContain('summary');
    });

    it('should handle numbers and booleans', () => {
      const json = '{"servings": 4, "prepTimeMinutes": 15, "isSpicy": true}';
      const updates = parser.processChunk(json);

      expect(updates.length).toBeGreaterThanOrEqual(3);
      const fields = updates
        .filter((u): u is Extract<StreamUpdate, { type: 'field' }> => u.type === 'field')
        .reduce((acc, u) => {
          acc[u.field] = u.value;
          return acc;
        }, {} as Record<string, unknown>);

      expect(fields.servings).toBe(4);
      expect(fields.prepTimeMinutes).toBe(15);
      expect(fields.isSpicy).toBe(true);
    });
  });

  describe('finalize', () => {
    it('should return complete signal', () => {
      const result = parser.finalize();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'complete' });
    });

    it('should process remaining buffer on finalize', () => {
      parser.processChunk('{"title": "Chicken');
      const result = parser.finalize();

      // Should return complete signal even with incomplete buffer
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[result.length - 1]).toEqual({ type: 'complete' });
    });

    it('should clear buffer after finalize', () => {
      parser.processChunk('{"title": "Chicken');
      parser.finalize();

      // Next chunk should be processed fresh
      const updates = parser.processChunk('{"title": "New Recipe"}');
      expect(updates.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty chunks', () => {
      const updates = parser.processChunk('');
      expect(updates).toHaveLength(0);
    });

    it('should handle whitespace-only chunks', () => {
      const updates = parser.processChunk('   \n\t  ');
      expect(updates).toHaveLength(0);
    });

    it('should handle malformed JSON gracefully', () => {
      const malformed = '{"title": "Chicken" invalid}';
      const updates = parser.processChunk(malformed);

      // Should not crash, may return 0 or partial results
      expect(Array.isArray(updates)).toBe(true);
    });

    it('should handle multiple complete objects in one chunk', () => {
      const multipleObjects =
        '{"title": "Recipe 1"}{"title": "Recipe 2", "summary": "Second recipe"}';
      const updates = parser.processChunk(multipleObjects);

      // Should extract fields from both objects
      expect(updates.length).toBeGreaterThanOrEqual(2);
      const titles = updates
        .filter((u): u is Extract<StreamUpdate, { type: 'field' }> => u.type === 'field')
        .filter((u) => u.field === 'title')
        .map((u) => u.value);
      expect(titles).toContain('Recipe 2');
    });

    it('should handle null values', () => {
      const json = '{"description": null, "image_url": null}';
      const updates = parser.processChunk(json);

      expect(updates.length).toBeGreaterThanOrEqual(2);
      const nullFields = updates
        .filter((u): u is Extract<StreamUpdate, { type: 'field' }> => u.type === 'field')
        .filter((u) => u.value === null);
      expect(nullFields.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      parser.processChunk('{"title": "Test"}');
      parser.reset();

      // After reset, should process fresh
      const updates = parser.processChunk('{"title": "New"}');
      expect(updates.length).toBeGreaterThanOrEqual(1);
      if (updates[0] && updates[0].type === 'field') {
        expect(updates[0].value).toBe('New');
      }
    });
  });
});

