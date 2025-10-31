/**
 * Utility functions for parsing and building tag URLs
 */

/**
 * Parses tags from a URLSearchParams object (used in feed page)
 * Handles both "+" separator format and single tag format
 * Note: URLSearchParams automatically decodes "+" to spaces, so we check for spaces too
 */
export function parseTagsFromUrl(searchParams: URLSearchParams): string[] {
  const tagsParam = searchParams.get("tags");
  if (!tagsParam) return [];

  // URLSearchParams automatically decodes "+" to spaces, so we check for spaces
  // This handles both "vegetarian+italian" (decoded to "vegetarian italian")
  // and cases where spaces are explicitly used
  if (tagsParam.includes(" ") || tagsParam.includes("+")) {
    return tagsParam
      .split(/[\s+]+/) // Split on both spaces and +
      .map((tag) => {
        try {
          return decodeURIComponent(tag.trim());
        } catch {
          return tag.trim();
        }
      })
      .filter((tag) => tag.length > 0);
  }

  // Single tag (might be encoded)
  try {
    return [decodeURIComponent(tagsParam.trim())].filter((tag) => tag.length > 0);
  } catch {
    return [tagsParam.trim()].filter((tag) => tag.length > 0);
  }
}

/**
 * Parses tags from a raw query string parameter (used in API routes)
 * Normalizes tags to lowercase for consistency
 */
export function parseTagsFromQuery(tagsParam: string | null): string[] {
  if (!tagsParam) return [];
  return tagsParam
    .split("+")
    .map((tag) => {
      try {
        return decodeURIComponent(tag.trim()).toLowerCase();
      } catch {
        return tag.trim().toLowerCase();
      }
    })
    .filter((tag) => tag.length > 0);
}

/**
 * Parses tags from the current window location URL
 * Handles both "+" separator and malformed "%20" separator formats
 */
export function parseTagsFromWindowUrl(): string[] {
  if (typeof window === "undefined") return [];

  const urlObj = new URL(window.location.href);
  if (!urlObj.search) return [];

  const rawSearch = urlObj.search;
  const tagsMatch = rawSearch.match(/[?&]tags=([^&]*)/);
  if (!tagsMatch) return [];

  const rawTagsValue = tagsMatch[1];

  // Split by + in the raw value (before decoding)
  let parts: string[];
  if (rawTagsValue.includes("+")) {
    // Contains + separator (correct format)
    parts = rawTagsValue.split("+");
  } else if (rawTagsValue.includes("%20")) {
    // Contains %20 (malformed - spaces used as separator)
    // Decode and split by space
    try {
      const decoded = decodeURIComponent(rawTagsValue);
      parts = decoded.split(/\s+/);
    } catch {
      parts = [rawTagsValue];
    }
  } else {
    // Single tag or no separator
    parts = [rawTagsValue];
  }

  // Decode each tag part and normalize to lowercase
  return parts
    .map((t) => {
      try {
        return decodeURIComponent(t.trim()).toLowerCase();
      } catch {
        return t.trim().toLowerCase();
      }
    })
    .filter((t) => t.length > 0);
}

/**
 * Builds a URL query string for tags
 * @param tags Array of tag strings
 * @returns Query string like "beef+glutenfree" or empty string if no tags
 */
export function buildTagsQuery(tags: string[]): string {
  if (tags.length === 0) return "";
  return tags.map(encodeURIComponent).join("+");
}

/**
 * Builds a feed URL with tags
 * @param tags Array of tag strings
 * @returns URL path like "/feed?tags=beef+glutenfree" or "/feed" if no tags
 */
export function buildFeedUrlWithTags(tags: string[]): string {
  const query = buildTagsQuery(tags);
  return query ? `/feed?tags=${query}` : "/feed";
}

/**
 * Toggles a tag in the current URL and returns the new URL
 * @param tag The tag to toggle
 * @returns The new feed URL with updated tags
 */
export function toggleTagInUrl(tag: string): string {
  if (typeof window === "undefined") {
    return `/feed?tags=${encodeURIComponent(tag)}`;
  }

  const existingTags = parseTagsFromWindowUrl();
  const normalizedTag = tag.toLowerCase();

  // Toggle: remove tag if it exists, add if it doesn't
  const tagIndex = existingTags.findIndex((t) => t === normalizedTag);
  let newTags: string[];

  if (tagIndex > -1) {
    // Tag exists, remove it
    newTags = existingTags.filter((t) => t !== normalizedTag);
  } else {
    // Tag doesn't exist, add it
    newTags = [...existingTags, normalizedTag];
  }

  // Remove duplicates (safety check)
  newTags = Array.from(new Set(newTags));

  return buildFeedUrlWithTags(newTags);
}
