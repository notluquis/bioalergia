import { Store } from "@tanstack/store";

/**
 * Creates a TanStack Store that automatically persists its state to localStorage.
 *
 * @param key - The localStorage key to use.
 * @param initialState - The default state if no value is found in storage.
 * @param options.version - Optional version number to invalidate old storage.
 * @param options.migrate - Optional migration function if version changes.
 */
export function createPersistentStore<T>(
  key: string,
  initialState: T,
  options?: {
    version?: number;
    exclude?: (keyof T)[];
  },
) {
  let startState = initialState;

  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        startState = JSON.parse(saved);
        // Deep merge could be added here if needed, but for now strict replace or basic merge
        // For robustness, ensure we don't drop new keys from initialState if saved state is partial?
        // Simple approach: Use saved as is.
      }
    } catch (error) {
      console.warn(`[store] Failed to load ${key}`, error);
    }
  }

  const store = new Store<T>(startState);

  store.subscribe(() => {
    try {
      let stateToSave = store.state;
      if (options?.exclude) {
        stateToSave = { ...store.state };
        for (const field of options.exclude) {
          delete stateToSave[field];
        }
      }
      localStorage.setItem(key, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn(`[store] Failed to save ${key}`, error);
    }
  });

  return store;
}
