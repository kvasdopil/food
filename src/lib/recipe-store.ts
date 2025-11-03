/**
 * Centralized storage for recipe data with IndexedDB persistence.
 * 
 * Stores both partial data (from feed: image, name, description, tags) 
 * and full data (from detail page: includes ingredients and instructions).
 * This allows showing cached data in preloaders while fetching complete data.
 * 
 * Data is persisted to IndexedDB for offline access and faster loading on subsequent visits.
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";

export type RecipePartialData = {
  slug: string;
  name: string;
  description: string | null;
  tags: string[];
  image_url: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
};

export type RecipeFullData = {
  slug: string;
  name: string;
  description: string;
  ingredients: string;
  instructions: string;
  imageUrl: string | null;
  tags: string[];
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
};

type StoredRecipe = {
  partial: RecipePartialData;
  full: RecipeFullData | null;
};

interface RecipeStoreDB extends DBSchema {
  recipes: {
    key: string; // slug (primary key)
    value: StoredRecipe;
  };
}

const DB_NAME = "recipe-store";
const DB_VERSION = 2; // Incremented to trigger upgrade and fix keyPath issue
const STORE_NAME = "recipes";

class RecipeStore {
  private store = new Map<string, StoredRecipe>();
  private dbPromise: Promise<IDBPDatabase<RecipeStoreDB> | null> | null = null;
  private initialized = false;

  /**
   * Initialize IndexedDB connection.
   * Safe to call multiple times.
   */
  private async getDB(): Promise<IDBPDatabase<RecipeStoreDB> | null> {
    // SSR check
    if (typeof window === "undefined") {
      return null;
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = openDB<RecipeStoreDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Delete the old store if it exists (in case of schema changes)
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        // Create new store without keyPath - we'll provide keys manually
        db.createObjectStore(STORE_NAME);
      },
    }).catch((error) => {
      console.warn("Failed to open IndexedDB:", error);
      this.dbPromise = null;
      return null;
    });

    return this.dbPromise;
  }

  /**
   * Load all recipes from IndexedDB into memory.
   * Should be called once on initialization.
   */
  async initialize(): Promise<void> {
    if (this.initialized || typeof window === "undefined") {
      return;
    }

    try {
      const db = await this.getDB();
      if (!db) return;

      const allRecipes = await db.getAll(STORE_NAME);
      for (const storedRecipe of allRecipes) {
        if (storedRecipe && storedRecipe.partial) {
          this.store.set(storedRecipe.partial.slug, storedRecipe);
        }
      }

      this.initialized = true;
    } catch (error) {
      console.warn("Failed to initialize recipe store from IndexedDB:", error);
    }
  }

  /**
   * Persist a recipe to IndexedDB.
   * Non-blocking - errors are logged but don't throw.
   */
  private async persistToDB(recipe: StoredRecipe): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const db = await this.getDB();
      if (!db) return;

      await db.put(STORE_NAME, recipe, recipe.partial.slug);
    } catch (error) {
      console.warn("Failed to persist recipe to IndexedDB:", error);
      // Don't throw - in-memory cache still works
    }
  }

  /**
   * Store partial recipe data (from feed).
   * This data is immediately available for preloaders.
   */
  setPartial(recipe: RecipePartialData): void {
    const existing = this.store.get(recipe.slug);
    
    const storedRecipe: StoredRecipe = existing
      ? {
          partial: recipe,
          full: existing.full,
        }
      : {
          partial: recipe,
          full: null,
        };

    this.store.set(recipe.slug, storedRecipe);
    
    // Persist to IndexedDB (non-blocking)
    this.persistToDB(storedRecipe).catch(() => {
      // Error already logged in persistToDB
    });
  }

  /**
   * Store multiple partial recipes (from feed batch).
   */
  setPartials(recipes: RecipePartialData[]): void {
    for (const recipe of recipes) {
      this.setPartial(recipe);
    }
  }

  /**
   * Store full recipe data (from detail page).
   * Merges with existing partial data if present.
   */
  setFull(recipe: RecipeFullData): void {
    const existing = this.store.get(recipe.slug);
    
    // Convert full data format to partial format for consistency
    const partial: RecipePartialData = {
      slug: recipe.slug,
      name: recipe.name,
      description: recipe.description,
      tags: recipe.tags,
      image_url: recipe.imageUrl,
    };

    const storedRecipe: StoredRecipe = {
      partial: existing?.partial || partial,
      full: recipe,
    };

    this.store.set(recipe.slug, storedRecipe);
    
    // Persist to IndexedDB (non-blocking)
    this.persistToDB(storedRecipe).catch(() => {
      // Error already logged in persistToDB
    });
  }

  /**
   * Get partial recipe data (image, name, description, tags).
   * Returns null if not found.
   */
  getPartial(slug: string): RecipePartialData | null {
    const stored = this.store.get(slug);
    return stored?.partial || null;
  }

  /**
   * Get full recipe data.
   * Returns null if not found or only partial data is available.
   */
  getFull(slug: string): RecipeFullData | null {
    const stored = this.store.get(slug);
    return stored?.full || null;
  }

  /**
   * Check if partial data exists for a slug.
   */
  hasPartial(slug: string): boolean {
    return this.store.has(slug);
  }

  /**
   * Check if full data exists for a slug.
   */
  hasFull(slug: string): boolean {
    const stored = this.store.get(slug);
    return stored?.full !== null;
  }

  /**
   * Get all cached partial recipes.
   * Useful for showing cached data while loading.
   */
  getAllPartials(): RecipePartialData[] {
    const partials: RecipePartialData[] = [];
    for (const stored of this.store.values()) {
      if (stored.partial) {
        partials.push(stored.partial);
      }
    }
    return partials;
  }

  /**
   * Clear all stored data (both memory and IndexedDB).
   */
  async clear(): Promise<void> {
    this.store.clear();

    if (typeof window === "undefined") {
      return;
    }

    try {
      const db = await this.getDB();
      if (!db) return;

      await db.clear(STORE_NAME);
    } catch (error) {
      console.warn("Failed to clear IndexedDB:", error);
    }
  }

  /**
   * Remove a specific recipe from storage (both memory and IndexedDB).
   */
  async remove(slug: string): Promise<void> {
    this.store.delete(slug);

    if (typeof window === "undefined") {
      return;
    }

    try {
      const db = await this.getDB();
      if (!db) return;

      await db.delete(STORE_NAME, slug);
    } catch (error) {
      console.warn("Failed to remove recipe from IndexedDB:", error);
    }
  }
}

// Export singleton instance
export const recipeStore = new RecipeStore();

// Initialize IndexedDB on client-side
if (typeof window !== "undefined") {
  recipeStore.initialize().catch((error) => {
    console.warn("Failed to initialize recipe store:", error);
  });
}

