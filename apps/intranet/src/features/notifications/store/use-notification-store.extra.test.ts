import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type NotificationStoreModule = typeof import("./use-notification-store");

const storageKey = (scope: string) => `bioalergia-notification-history:${scope}`;

async function loadStoreModule(): Promise<NotificationStoreModule> {
  vi.resetModules();
  return import("./use-notification-store");
}

function createStorageMock(): Storage {
  const storage = new Map<string, string>();
  return {
    clear: () => {
      storage.clear();
    },
    getItem: (key: string) => storage.get(key) ?? null,
    key: (index: number) => Array.from(storage.keys())[index] ?? null,
    get length() {
      return storage.size;
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  };
}

describe("use-notification-store — additional branches", () => {
  beforeEach(() => {
    const storageMock = createStorageMock();
    vi.stubGlobal("localStorage", storageMock);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storageMock,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to initial state when persisted JSON is malformed", async () => {
    globalThis.localStorage.setItem(storageKey("guest"), "{not-json");
    const storeModule = await loadStoreModule();
    expect(storeModule.notificationStore.state.notifications).toHaveLength(0);
    expect(storeModule.notificationStore.state.unreadCount).toBe(0);
  });

  it("falls back when persisted shape is invalid (missing fields)", async () => {
    globalThis.localStorage.setItem(
      storageKey("guest"),
      JSON.stringify({ unreadCount: "not-a-number" })
    );
    const storeModule = await loadStoreModule();
    expect(storeModule.notificationStore.state.notifications).toHaveLength(0);
  });

  it("falls back when persisted value is a primitive (non-object)", async () => {
    globalThis.localStorage.setItem(storageKey("guest"), JSON.stringify(42));
    const storeModule = await loadStoreModule();
    expect(storeModule.notificationStore.state.notifications).toHaveLength(0);
  });

  it("falls back when persisted value is null", async () => {
    globalThis.localStorage.setItem(storageKey("guest"), "null");
    const storeModule = await loadStoreModule();
    expect(storeModule.notificationStore.state.notifications).toHaveLength(0);
  });

  it("setNotificationScope is a no-op when next scope equals current scope", async () => {
    const storeModule = await loadStoreModule();
    // Default scope is "guest"; passing null/undefined keeps scope == DEFAULT_SCOPE
    storeModule.addNotification({ message: "kept", type: "info" });
    expect(storeModule.notificationStore.state.notifications).toHaveLength(1);

    storeModule.setNotificationScope(null);
    // Should NOT clear notifications since scope did not change
    expect(storeModule.notificationStore.state.notifications).toHaveLength(1);
  });

  it("removeNotification on missing id leaves unread count unchanged", async () => {
    const storeModule = await loadStoreModule();
    storeModule.addNotification({ message: "a", type: "info" });
    expect(storeModule.notificationStore.state.unreadCount).toBe(1);
    storeModule.removeNotification("does-not-exist");
    expect(storeModule.notificationStore.state.unreadCount).toBe(1);
    expect(storeModule.notificationStore.state.notifications).toHaveLength(1);
  });

  it("markAsRead on missing id is a no-op", async () => {
    const storeModule = await loadStoreModule();
    storeModule.addNotification({ message: "a", type: "info" });
    storeModule.markAsRead("nope");
    expect(storeModule.notificationStore.state.unreadCount).toBe(1);
  });
});
