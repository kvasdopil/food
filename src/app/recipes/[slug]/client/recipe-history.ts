"use client";

const HISTORY_STORAGE_KEY = "recipe-carousel-history";

type HistoryEntry = string | null;

export type RecipeHistorySnapshot = {
  stack: HistoryEntry[];
  index: number;
};

let cachedSnapshot: RecipeHistorySnapshot | null = null;

function sanitizeSnapshot(snapshot: RecipeHistorySnapshot): RecipeHistorySnapshot {
  const stack = Array.isArray(snapshot.stack)
    ? snapshot.stack.map((entry) => (typeof entry === "string" ? entry : null))
    : [];
  const index =
    typeof snapshot.index === "number" && snapshot.index >= 0 && snapshot.index < stack.length
      ? snapshot.index
      : Math.max(0, stack.length - 1);

  return { stack, index };
}

function readSnapshot(): RecipeHistorySnapshot {
  if (typeof window === "undefined") {
    return { stack: [], index: 0 };
  }

  if (cachedSnapshot) {
    return { stack: [...cachedSnapshot.stack], index: cachedSnapshot.index };
  }

  try {
    const rawValue = window.sessionStorage.getItem(HISTORY_STORAGE_KEY);
    if (!rawValue) {
      cachedSnapshot = { stack: [], index: 0 };
      return { stack: [], index: 0 };
    }

    const parsed = JSON.parse(rawValue);
    const snapshot = sanitizeSnapshot(parsed);
    cachedSnapshot = snapshot;
    return { stack: [...snapshot.stack], index: snapshot.index };
  } catch (error) {
    console.warn("Failed to read recipe history snapshot:", error);
    cachedSnapshot = { stack: [], index: 0 };
    return { stack: [], index: 0 };
  }
}

function writeSnapshot(snapshot: RecipeHistorySnapshot): void {
  if (typeof window === "undefined") {
    return;
  }

  cachedSnapshot = {
    stack: [...snapshot.stack],
    index: snapshot.index,
  };

  try {
    window.sessionStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify({
        stack: cachedSnapshot.stack,
        index: cachedSnapshot.index,
      }),
    );
  } catch (error) {
    console.warn("Failed to write recipe history snapshot:", error);
  }
}

function hasRecipeReferrer(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  if (!document.referrer) {
    return false;
  }

  try {
    const referrerUrl = new URL(document.referrer);
    if (referrerUrl.origin !== window.location.origin) {
      return false;
    }
    return referrerUrl.pathname.startsWith("/recipes/");
  } catch (error) {
    console.warn("Failed to parse referrer URL:", error);
    return false;
  }
}

export function syncHistoryWithCurrentSlug(slug: string): RecipeHistorySnapshot {
  if (typeof window === "undefined") {
    const snapshot = { stack: [slug], index: 0 };
    cachedSnapshot = snapshot;
    return snapshot;
  }

  const fromRecipePage = hasRecipeReferrer();
  const currentSnapshot = readSnapshot();
  console.log("[history] sync start", {
    slug,
    fromRecipePage,
    cached: cachedSnapshot,
    currentSnapshot,
  });

  if (currentSnapshot.stack.length === 0) {
    const snapshot = { stack: [slug], index: 0 };
    writeSnapshot(snapshot);
    console.log("[history] init stack", snapshot);
    return snapshot;
  }

  if (!fromRecipePage) {
    const existingIndex = currentSnapshot.stack.findIndex((entry) => entry === slug);
    if (existingIndex !== -1) {
      const snapshot = { stack: currentSnapshot.stack, index: existingIndex };
      writeSnapshot(snapshot);
      console.log("[history] reused without referrer", snapshot);
      return snapshot;
    }

    const snapshot = { stack: [slug], index: 0 };
    writeSnapshot(snapshot);
    console.log("[history] reset stack (no referrer match)", snapshot);
    return snapshot;
  }

  const { stack, index } = currentSnapshot;

  if (stack[index] === slug) {
    console.log("[history] slug unchanged", currentSnapshot);
    return currentSnapshot;
  }

  const existingIndex = stack.findIndex((entry) => entry === slug);
  if (existingIndex !== -1) {
    const snapshot = { stack, index: existingIndex };
    writeSnapshot(snapshot);
    console.log("[history] reused existing entry", snapshot);
    return snapshot;
  }

  const truncatedStack = stack.slice(0, index + 1);
  truncatedStack.push(slug);
  const snapshot = { stack: truncatedStack, index: truncatedStack.length - 1 };
  writeSnapshot(snapshot);
  console.log("[history] appended slug", snapshot);
  return snapshot;
}

export function pushSlugOntoHistory(
  snapshot: RecipeHistorySnapshot,
  slug: string,
): RecipeHistorySnapshot {
  const truncatedStack = snapshot.stack.slice(0, snapshot.index + 1);
  truncatedStack.push(slug);
  const nextSnapshot = { stack: truncatedStack, index: truncatedStack.length - 1 };
  writeSnapshot(nextSnapshot);
  console.log("[history] push", { slug, previous: snapshot, next: nextSnapshot });
  return nextSnapshot;
}

export function moveHistoryBackward(snapshot: RecipeHistorySnapshot): RecipeHistorySnapshot | null {
  if (snapshot.index <= 0) {
    return null;
  }

  const nextSnapshot = { stack: snapshot.stack, index: snapshot.index - 1 };
  writeSnapshot(nextSnapshot);
  console.log("[history] move backward", { previous: snapshot, next: nextSnapshot });
  return nextSnapshot;
}

export function getPreviousSlug(snapshot: RecipeHistorySnapshot | null): string | null {
  if (!snapshot) {
    return null;
  }

  if (snapshot.index <= 0) {
    return null;
  }

  const value = snapshot.stack[snapshot.index - 1];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function getCurrentSlug(snapshot: RecipeHistorySnapshot | null): string | null {
  if (!snapshot) {
    return null;
  }

  const value = snapshot.stack[snapshot.index];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function hasPreviousRecipe(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const snapshot = readSnapshot();
  console.log("[history] hasPreviousRecipe", snapshot);
  if (snapshot.index <= 0) {
    return false;
  }

  const value = snapshot.stack[snapshot.index - 1];
  return typeof value === "string" && value.length > 0;
}
