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
 * Builds a feed URL with tags and optional search query
 * @param tags Array of tag strings
 * @param searchQuery Optional search query string
 * @param preserveParams Optional URLSearchParams to preserve additional parameters (like favorites)
 * @returns URL path like "/feed?tags=beef+glutenfree&q=chicken" or "/feed?q=chicken"
 */
export function buildFeedUrlWithTagsAndSearch(
  tags: string[],
  searchQuery?: string,
  preserveParams?: URLSearchParams,
): string {
  const parts: string[] = [];

  // Build tags parameter manually (don't use URLSearchParams for tags to avoid encoding +)
  if (tags.length > 0) {
    const tagsQuery = buildTagsQuery(tags);
    parts.push(`tags=${tagsQuery}`);
  }

  // Build search query parameter
  if (searchQuery && searchQuery.trim()) {
    // Use encodeURIComponent to properly encode the search query
    parts.push(`q=${encodeURIComponent(searchQuery.trim())}`);
  }

  // Preserve existing parameters if provided (like favorites)
  if (preserveParams) {
    for (const [key, value] of preserveParams.entries()) {
      // Don't override tags and q if they're being set
      if (key !== "tags" && key !== "q") {
        parts.push(`${key}=${encodeURIComponent(value)}`);
      }
    }
  }

  const queryString = parts.join("&");
  return queryString ? `/feed?${queryString}` : "/feed";
}

/**
 * Toggles a tag in the current URL and returns the new URL
 * @param tag The tag to toggle
 * @returns The new feed URL with updated tags (preserves search query)
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

  // Preserve search query and other parameters (like favorites) from URL
  const urlObj = new URL(window.location.href);
  const searchQuery = urlObj.searchParams.get("q") || "";

  return buildFeedUrlWithTagsAndSearch(newTags, searchQuery, urlObj.searchParams);
}

/**
 * Extracts query parameters (tags and search query) from a referrer URL
 * @param referrerUrl The referrer URL (from document.referrer)
 * @returns Object with tags array and search query, or null if not a feed URL
 */
export function extractFeedQueryParams(referrerUrl: string | null): {
  tags: string[];
  searchQuery: string;
} | null {
  if (!referrerUrl) return null;

  try {
    // Check if it's a feed URL
    const url = new URL(referrerUrl);
    if (!url.pathname.includes("/feed")) {
      return null;
    }

    const tagsParam = url.searchParams.get("tags");
    const searchQuery = url.searchParams.get("q") || "";

    const tags = tagsParam ? parseTagsFromQuery(tagsParam) : [];

    return { tags, searchQuery };
  } catch {
    return null;
  }
}

const FEED_URL_STORAGE_KEY = "recipe-feed-back-url";

/**
 * Stores the current feed URL in sessionStorage for back navigation
 * Call this when on the feed page to preserve filters when navigating to recipes
 */
export function storeFeedUrl(): void {
  if (typeof window === "undefined") return;

  try {
    const currentUrl = window.location.href;
    // Only store if we're on the feed page
    if (currentUrl.includes("/feed")) {
      sessionStorage.setItem(FEED_URL_STORAGE_KEY, currentUrl);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Gets the stored feed URL from sessionStorage
 * @returns The feed URL with query parameters, or null if not found
 */
export function getStoredFeedUrl(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return sessionStorage.getItem(FEED_URL_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Gets the back-to-feed URL, extracting query params from stored URL or referrer
 * @returns Feed URL with preserved query parameters, or "/feed" as fallback
 */
export function getBackToFeedUrl(): string {
  if (typeof window === "undefined") return "/feed";

  // First, try to get from sessionStorage (most reliable)
  const storedUrl = getStoredFeedUrl();
  if (storedUrl) {
    try {
      const url = new URL(storedUrl);
      if (url.pathname.includes("/feed")) {
        const tagsParam = url.searchParams.get("tags");
        const searchQuery = url.searchParams.get("q") || "";
        const tags = tagsParam ? parseTagsFromQuery(tagsParam) : [];
        return buildFeedUrlWithTagsAndSearch(tags, searchQuery);
      }
    } catch {
      // If parsing fails, fall through to referrer check
    }
  }

  // Fallback to checking referrer
  const referrerParams = extractFeedQueryParams(document.referrer);
  if (referrerParams) {
    return buildFeedUrlWithTagsAndSearch(referrerParams.tags, referrerParams.searchQuery);
  }

  return "/feed";
}
