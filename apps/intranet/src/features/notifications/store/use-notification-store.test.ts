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

describe("use-notification-store", () => {
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

  it("hydrates guest scope from localStorage", async () => {
    globalThis.localStorage.setItem(
      storageKey("guest"),
      JSON.stringify({
        notifications: [
          {
            id: "n1",
            type: "info",
            title: "Info",
            message: "Persisted",
            timestamp: 1700000000000,
            read: false,
          },
        ],
        unreadCount: 1,
      }),
    );

    const storeModule = await loadStoreModule();
    expect(storeModule.notificationStore.state.notifications).toHaveLength(1);
    expect(storeModule.notificationStore.state.notifications[0]?.message).toBe("Persisted");
    expect(storeModule.notificationStore.state.unreadCount).toBe(1);
  });

  it("adds notifications, persists state and limits history to 50", async () => {
    const storeModule = await loadStoreModule();

    for (let i = 0; i < 55; i += 1) {
      storeModule.addNotification({
        type: "success",
        title: "T",
        message: `message-${i}`,
      });
    }

    expect(storeModule.notificationStore.state.notifications).toHaveLength(50);
    expect(storeModule.notificationStore.state.unreadCount).toBe(55);
    expect(storeModule.notificationStore.state.notifications[0]?.message).toBe("message-54");
    expect(storeModule.notificationStore.state.notifications[49]?.message).toBe("message-5");

    const persisted = JSON.parse(globalThis.localStorage.getItem(storageKey("guest")) ?? "{}");
    expect(persisted.notifications).toHaveLength(50);
    expect(persisted.unreadCount).toBe(55);
  });

  it("marks a notification as read only once", async () => {
    const storeModule = await loadStoreModule();
    storeModule.addNotification({
      type: "warning",
      title: "Warn",
      message: "Needs review",
    });

    const id = storeModule.notificationStore.state.notifications[0]?.id;
    expect(id).toBeDefined();
    if (!id) {
      return;
    }

    storeModule.markAsRead(id);
    expect(storeModule.notificationStore.state.notifications[0]?.read).toBe(true);
    expect(storeModule.notificationStore.state.unreadCount).toBe(0);

    storeModule.markAsRead(id);
    expect(storeModule.notificationStore.state.unreadCount).toBe(0);
  });

  it("removes notification and updates unread count correctly", async () => {
    const storeModule = await loadStoreModule();
    storeModule.addNotification({
      type: "error",
      title: "Error",
      message: "Unread",
    });
    storeModule.addNotification({
      type: "info",
      title: "Info",
      message: "Second unread",
    });

    const [first, second] = storeModule.notificationStore.state.notifications;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) {
      return;
    }

    storeModule.markAsRead(second.id);
    expect(storeModule.notificationStore.state.unreadCount).toBe(1);

    storeModule.removeNotification(first.id);
    expect(storeModule.notificationStore.state.notifications).toHaveLength(1);
    expect(storeModule.notificationStore.state.unreadCount).toBe(0);
  });

  it("marks all as read and clears all", async () => {
    const storeModule = await loadStoreModule();
    storeModule.addNotification({
      type: "success",
      title: "A",
      message: "One",
    });
    storeModule.addNotification({
      type: "success",
      title: "B",
      message: "Two",
    });

    storeModule.markAllAsRead();
    expect(storeModule.notificationStore.state.notifications.every((n) => n.read)).toBe(true);
    expect(storeModule.notificationStore.state.unreadCount).toBe(0);

    storeModule.clearAll();
    expect(storeModule.notificationStore.state.notifications).toHaveLength(0);
    expect(storeModule.notificationStore.state.unreadCount).toBe(0);
  });

  it("keeps histories isolated between user scopes", async () => {
    const storeModule = await loadStoreModule();

    storeModule.setNotificationScope(1);
    storeModule.addNotification({
      type: "success",
      title: "User 1",
      message: "only-user-1",
    });

    storeModule.setNotificationScope(2);
    expect(storeModule.notificationStore.state.notifications).toHaveLength(0);
    storeModule.addNotification({
      type: "info",
      title: "User 2",
      message: "only-user-2",
    });

    storeModule.setNotificationScope(1);
    expect(storeModule.notificationStore.state.notifications).toHaveLength(1);
    expect(storeModule.notificationStore.state.notifications[0]?.message).toBe("only-user-1");

    storeModule.setNotificationScope(2);
    expect(storeModule.notificationStore.state.notifications).toHaveLength(1);
    expect(storeModule.notificationStore.state.notifications[0]?.message).toBe("only-user-2");

    const user1Persisted = JSON.parse(
      globalThis.localStorage.getItem(storageKey("user-1")) ?? "{}",
    );
    const user2Persisted = JSON.parse(
      globalThis.localStorage.getItem(storageKey("user-2")) ?? "{}",
    );
    expect(user1Persisted.notifications[0]?.message).toBe("only-user-1");
    expect(user2Persisted.notifications[0]?.message).toBe("only-user-2");
  });
});
