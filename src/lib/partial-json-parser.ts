export interface FieldUpdate {
  type: 'field';
  field: string;
  value: unknown;
}

export interface CompleteUpdate {
  type: 'complete';
}

export type StreamUpdate = FieldUpdate | CompleteUpdate;

/**
 * Parser that extracts complete fields from partial JSON as it streams in.
 * Handles incomplete JSON gracefully by buffering and parsing incrementally.
 */
export class PartialJsonParser {
  private buffer = '';
  private extractedFields = new Map<string, unknown>();

  /**
   * Processes a chunk of JSON text and extracts complete fields.
   * Returns updates for newly extracted or changed fields.
   * @param chunk - A chunk of JSON text (may be incomplete)
   * @returns Array of stream updates for complete fields
   */
  processChunk(chunk: string): StreamUpdate[] {
    if (!chunk.trim()) {
      return [];
    }

    this.buffer += chunk;
    const updates: StreamUpdate[] = [];

    // First, try to extract complete JSON objects from the buffer
    const completeObjects = this.extractCompleteObjects(this.buffer);

    for (const jsonText of completeObjects) {
      try {
        const parsed = JSON.parse(jsonText) as Record<string, unknown>;

        // Extract new or updated fields
        for (const [key, value] of Object.entries(parsed)) {
          const currentValue = this.extractedFields.get(key);
          const valueChanged =
            currentValue === undefined ||
            JSON.stringify(currentValue) !== JSON.stringify(value);

          if (valueChanged) {
            this.extractedFields.set(key, value);
            updates.push({
              type: 'field',
              field: key,
              value,
            });
          }
        }

        // Remove parsed JSON from buffer
        const jsonEndIndex = this.buffer.indexOf(jsonText) + jsonText.length;
        this.buffer = this.buffer.substring(jsonEndIndex).trim();
      } catch {
        // Skip malformed JSON - might be incomplete
        continue;
      }
    }

    // Also try to extract complete field-value pairs from remaining buffer
    // This handles cases where the object isn't closed yet but fields are complete
    const completeFields = this.extractCompleteFields(this.buffer);
    for (const { key, value } of completeFields) {
      const currentValue = this.extractedFields.get(key);
      const valueChanged =
        currentValue === undefined ||
        JSON.stringify(currentValue) !== JSON.stringify(value);

      if (valueChanged) {
        this.extractedFields.set(key, value);
        updates.push({
          type: 'field',
          field: key,
          value,
        });
      }
    }

    return updates;
  }

  /**
   * Extracts complete field-value pairs from partial JSON.
   * Uses regex to find complete key-value pairs even when the object isn't closed.
   * Handles incomplete strings by tracking string boundaries.
   */
  private extractCompleteFields(buffer: string): Array<{ key: string; value: unknown }> {
    const fields: Array<{ key: string; value: unknown }> = [];
    
    // Try to extract complete key-value pairs by finding patterns like "key": value
    // We'll try to parse each potential pair to ensure it's valid JSON
    
    // Match pattern: "key": followed by a value (string, number, boolean, null, or array)
    // Look for the pattern ending with comma or closing brace (but don't consume it)
    const keyValuePattern = /"((?:[^"\\]|\\.)*)"\s*:\s*/g;
    let match;
    const processed = new Set<string>(); // Track processed keys to avoid duplicates
    
    while ((match = keyValuePattern.exec(buffer)) !== null) {
      const keyEnd = match.index + match[0].length;
      const key = JSON.parse(`"${match[1]}"`); // Properly unescape key
      
      // Skip if we've already processed this key
      if (processed.has(key)) {
        continue;
      }
      
      // Try to extract the value starting after the colon
      const valueStart = keyEnd;
      const remaining = buffer.substring(valueStart);
      
      // Try to parse different value types
      let value: unknown = undefined;
      let valueLength = 0;
      
      // Try string value - handle both complete and potentially incomplete strings
      // First try complete string (ends with " followed by comma or })
      const completeStringMatch = remaining.match(/^"((?:[^"\\]|\\.)*)"(?=\s*[,}])/);
      if (completeStringMatch) {
        try {
          value = JSON.parse(`"${completeStringMatch[1]}"`);
          valueLength = completeStringMatch[0].length;
        } catch {
          // Invalid string, skip
        }
      }
      
      // If no complete string, try to detect if we're in the middle of a string
      // This handles cases like "title": "Pho Bo where the string isn't closed yet
      if (value === undefined) {
        const incompleteStringMatch = remaining.match(/^"((?:[^"\\]|\\.)*)$/);
        // Don't extract incomplete strings - wait for them to complete
        // This prevents partial updates that would be overwritten immediately
      }
      
      // Try number value
      if (value === undefined) {
        const numberMatch = remaining.match(/^(-?\d+\.?\d*)(?=\s*[,}])/);
        if (numberMatch) {
          const numValue = Number(numberMatch[1]);
          if (!isNaN(numValue)) {
            value = numValue;
            valueLength = numberMatch[0].length;
          }
        }
      }
      
      // Try boolean value
      if (value === undefined) {
        const boolMatch = remaining.match(/^(true|false)(?=\s*[,}])/);
        if (boolMatch) {
          value = boolMatch[1] === 'true';
          valueLength = boolMatch[0].length;
        }
      }
      
      // Try null value
      if (value === undefined) {
        const nullMatch = remaining.match(/^(null)(?=\s*[,}])/);
        if (nullMatch) {
          value = null;
          valueLength = nullMatch[0].length;
        }
      }
      
      // Try array value - improved to handle nested structures better
      if (value === undefined) {
        // Look for array start and try to find matching closing bracket
        if (remaining.startsWith('[')) {
          let depth = 0;
          let inString = false;
          let escapeNext = false;
          let found = false;
          
          for (let i = 0; i < remaining.length; i++) {
            const char = remaining[i];
            
            if (char === '"' && !escapeNext) {
              inString = !inString;
            }
            escapeNext = char === '\\' && inString;
            
            if (!inString) {
              if (char === '[') {
                depth++;
              } else if (char === ']') {
                depth--;
                if (depth === 0) {
                  // Found complete array
                  const arrayText = remaining.substring(0, i + 1);
                  // Check if it's followed by comma or closing brace
                  if (remaining[i + 1] === ',' || remaining[i + 1] === '}' || remaining[i + 1] === undefined || /\s/.test(remaining[i + 1])) {
                    try {
                      value = JSON.parse(arrayText);
                      valueLength = arrayText.length;
                      found = true;
                    } catch {
                      // Invalid array, skip
                    }
                  }
                  break;
                }
              }
            }
          }
        }
      }
      
      // Try object value (for nested objects)
      if (value === undefined) {
        if (remaining.startsWith('{')) {
          let depth = 0;
          let inString = false;
          let escapeNext = false;
          
          for (let i = 0; i < remaining.length; i++) {
            const char = remaining[i];
            
            if (char === '"' && !escapeNext) {
              inString = !inString;
            }
            escapeNext = char === '\\' && inString;
            
            if (!inString) {
              if (char === '{') {
                depth++;
              } else if (char === '}') {
                depth--;
                if (depth === 0) {
                  // Found complete object
                  const objectText = remaining.substring(0, i + 1);
                  // Check if it's followed by comma or closing brace
                  if (remaining[i + 1] === ',' || remaining[i + 1] === '}' || remaining[i + 1] === undefined || /\s/.test(remaining[i + 1])) {
                    try {
                      value = JSON.parse(objectText);
                      valueLength = objectText.length;
                    } catch {
                      // Invalid object, skip
                    }
                  }
                  break;
                }
              }
            }
          }
        }
      }
      
      // If we found a valid value, add it
      if (value !== undefined && valueLength > 0) {
        processed.add(key);
        fields.push({ key, value });
      }
    }
    
    return fields;
  }

  /**
   * Attempts to extract complete JSON objects from the buffer.
   * A complete object is one that has matching braces and complete string values.
   */
  private extractCompleteObjects(buffer: string): string[] {
    const objects: string[] = [];
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let startIndex = -1;

    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i];

      // Track string boundaries (handle escaped quotes)
      if (char === '"' && !escapeNext) {
        inString = !inString;
      }

      escapeNext = char === '\\' && inString;

      // Track object depth (only outside strings)
      if (!inString) {
        if (char === '{') {
          if (depth === 0) {
            startIndex = i;
          }
          depth++;
        } else if (char === '}') {
          depth--;

          // When we close an object at depth 0, it's complete
          if (depth === 0 && startIndex !== -1) {
            const jsonText = buffer.substring(startIndex, i + 1);

            // Verify it's valid JSON before adding
            if (this.isValidCompleteJson(jsonText)) {
              objects.push(jsonText);
            }

            startIndex = -1;
          }
        }
      }
    }

    return objects;
  }

  /**
   * Checks if a JSON string represents a complete, valid JSON object.
   * Validates that all strings are closed and structure is complete.
   */
  private isValidCompleteJson(jsonText: string): boolean {
    // Quick check: must start with { and end with }
    if (!jsonText.trim().startsWith('{') || !jsonText.trim().endsWith('}')) {
      return false;
    }

    // Try parsing - if it succeeds, it's valid
    try {
      JSON.parse(jsonText);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets all currently extracted fields as updates.
   * Useful for sending all fields at once if needed.
   * @returns Array of field updates
   */
  getAllFields(): FieldUpdate[] {
    const updates: FieldUpdate[] = [];
    for (const [key, value] of this.extractedFields.entries()) {
      updates.push({
        type: 'field',
        field: key,
        value,
      });
    }
    return updates;
  }

  /**
   * Finalizes parsing and attempts to extract any remaining fields from the buffer.
   * Returns field updates for any newly extracted fields, followed by a completion signal.
   * @returns Array of updates (field updates + completion signal)
   */
  finalize(): StreamUpdate[] {
    const updates: StreamUpdate[] = [];
    
    // Try to parse any remaining buffer and extract fields
    if (this.buffer.trim()) {
      // First try to extract complete objects
      const completeObjects = this.extractCompleteObjects(this.buffer);
      for (const jsonText of completeObjects) {
        try {
          const parsed = JSON.parse(jsonText) as Record<string, unknown>;
          for (const [key, value] of Object.entries(parsed)) {
            const currentValue = this.extractedFields.get(key);
            const valueChanged =
              currentValue === undefined ||
              JSON.stringify(currentValue) !== JSON.stringify(value);

            if (valueChanged) {
              this.extractedFields.set(key, value);
              updates.push({
                type: 'field',
                field: key,
                value,
              });
            }
          }
        } catch {
          // Ignore - might be incomplete
        }
      }
      
      // Also try to extract complete fields from remaining buffer
      const completeFields = this.extractCompleteFields(this.buffer);
      for (const { key, value } of completeFields) {
        const currentValue = this.extractedFields.get(key);
        const valueChanged =
          currentValue === undefined ||
          JSON.stringify(currentValue) !== JSON.stringify(value);

        if (valueChanged) {
          this.extractedFields.set(key, value);
          updates.push({
            type: 'field',
            field: key,
            value,
          });
        }
      }
      
      // Last resort: try to parse the entire buffer as complete JSON
      if (updates.length === 0) {
        try {
          const parsed = JSON.parse(this.buffer.trim()) as Record<string, unknown>;
          for (const [key, value] of Object.entries(parsed)) {
            const currentValue = this.extractedFields.get(key);
            const valueChanged =
              currentValue === undefined ||
              JSON.stringify(currentValue) !== JSON.stringify(value);

            if (valueChanged) {
              this.extractedFields.set(key, value);
              updates.push({
                type: 'field',
                field: key,
                value,
              });
            }
          }
        } catch {
          // Ignore - buffer likely contains incomplete JSON
        }
      }
    }

    this.buffer = '';
    updates.push({ type: 'complete' });
    return updates;
  }

  /**
   * Resets the parser state (useful for testing or reusing the parser).
   */
  reset(): void {
    this.buffer = '';
    this.extractedFields.clear();
  }
}

