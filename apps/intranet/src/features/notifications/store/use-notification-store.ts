import { Store } from "@tanstack/store";

export type NotificationType = "success" | "error" | "info" | "warning";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
}

const STORAGE_PREFIX = "bioalergia-notification-history";
const DEFAULT_SCOPE = "guest";
const INITIAL_STATE: NotificationState = { notifications: [], unreadCount: 0 };

let currentScope = DEFAULT_SCOPE;

function getStorageKey(scope: string) {
  return `${STORAGE_PREFIX}:${scope}`;
}

function isNotificationState(value: unknown): value is NotificationState {
  if (!value || typeof value !== "object") {
    return false;
  }
  const state = value as Partial<NotificationState>;
  return Array.isArray(state.notifications) && typeof state.unreadCount === "number";
}

function loadState(scope: string): NotificationState {
  if (typeof window === "undefined") {
    return INITIAL_STATE;
  }
  try {
    const raw = localStorage.getItem(getStorageKey(scope));
    if (!raw) {
      return INITIAL_STATE;
    }
    const parsed = JSON.parse(raw);
    if (!isNotificationState(parsed)) {
      return INITIAL_STATE;
    }
    return parsed;
  } catch {
    return INITIAL_STATE;
  }
}

function saveState(scope: string, state: NotificationState) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(getStorageKey(scope), JSON.stringify(state));
  } catch {
    // ignore storage write failures (quota/private mode)
  }
}

function setStateAndPersist(
  updater: (state: NotificationState) => NotificationState,
): NotificationState {
  let nextState: NotificationState = INITIAL_STATE;
  notificationStore.setState((state) => {
    nextState = updater(state);
    return nextState;
  });
  saveState(currentScope, nextState);
  return nextState;
}

export const notificationStore = new Store<NotificationState>(loadState(currentScope));

export const setNotificationScope = (userId: null | number | string) => {
  const nextScope =
    userId === null || userId === undefined ? DEFAULT_SCOPE : `user-${String(userId)}`;
  if (nextScope === currentScope) {
    return;
  }
  currentScope = nextScope;
  notificationStore.setState(() => loadState(currentScope));
};

// Actions
export const addNotification = (
  notification: Omit<NotificationItem, "id" | "timestamp" | "read">,
) => {
  setStateAndPersist((state) => {
    const newItem: NotificationItem = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      read: false,
    };

    // Limit to 50 items
    const updatedList = [newItem, ...state.notifications].slice(0, 50);

    return {
      notifications: updatedList,
      unreadCount: state.unreadCount + 1,
    };
  });
};

export const markAsRead = (id: string) => {
  setStateAndPersist((state) => {
    const notification = state.notifications.find((n) => n.id === id);
    if (!notification || notification.read) {
      return state;
    }

    return {
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    };
  });
};

export const markAllAsRead = () => {
  setStateAndPersist((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, read: true })),
    unreadCount: 0,
  }));
};

export const clearAll = () => {
  setStateAndPersist(() => ({ notifications: [], unreadCount: 0 }));
};

export const removeNotification = (id: string) => {
  setStateAndPersist((state) => {
    const notification = state.notifications.find((n) => n.id === id);
    const wasUnread = notification ? !notification.read : false;

    return {
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    };
  });
};
