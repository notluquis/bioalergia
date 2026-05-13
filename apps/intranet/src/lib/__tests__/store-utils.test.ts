import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPersistentStore } from "../store-utils";

// Node 25 provides a native (experimental) localStorage that conflicts with jsdom.
// Stub it with a proper in-memory Map-backed implementation.
function makeLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", makeLocalStorageMock());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createPersistentStore", () => {
  it("initializes with provided initial state", () => {
    const store = createPersistentStore("test-store", { count: 0, name: "default" });
    expect(store.state.count).toBe(0);
    expect(store.state.name).toBe("default");
  });

  it("restores state from localStorage if present", () => {
    localStorage.setItem("test-restore", JSON.stringify({ count: 42, name: "saved" }));
    const store = createPersistentStore("test-restore", { count: 0, name: "default" });
    expect(store.state.count).toBe(42);
    expect(store.state.name).toBe("saved");
  });

  it("persists state to localStorage on update", () => {
    const store = createPersistentStore("test-persist", { value: 0 });
    store.setState(() => ({ value: 99 }));
    const saved = JSON.parse(localStorage.getItem("test-persist") ?? "null") as { value?: number };
    expect(saved?.value).toBe(99);
  });

  it("falls back to initial state when localStorage has invalid JSON", () => {
    localStorage.setItem("test-invalid", "{{invalid json}}");
    const store = createPersistentStore("test-invalid", { count: 5 });
    expect(store.state.count).toBe(5);
  });

  it("excludes specified keys from persistence", () => {
    const store = createPersistentStore(
      "test-exclude",
      { visible: true, token: "secret" },
      { exclude: ["token"] }
    );
    store.setState(() => ({ visible: false, token: "new-secret" }));
    const saved = JSON.parse(localStorage.getItem("test-exclude") ?? "null") as {
      visible?: boolean;
      token?: string;
    };
    expect(saved?.visible).toBe(false);
    expect(saved?.token).toBeUndefined();
  });

  it("warns when localStorage.setItem throws (line 47-48 catch)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
      removeItem: () => {},
      clear: () => {},
      length: 0,
      key: () => null,
    });
    const store = createPersistentStore("test-throw", { count: 0 });
    store.setState(() => ({ count: 1 }));
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to save"),
      expect.any(Error)
    );
    warnSpy.mockRestore();
  });
});
