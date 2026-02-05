import { createPersistentStore } from "@/lib/store-utils";

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

export const notificationStore = createPersistentStore<NotificationState>(
  "bioalergia-notification-history",
  { notifications: [], unreadCount: 0 },
);

// Actions
export const addNotification = (
  notification: Omit<NotificationItem, "id" | "timestamp" | "read">,
) => {
  notificationStore.setState((state) => {
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
  notificationStore.setState((state) => {
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
  notificationStore.setState((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, read: true })),
    unreadCount: 0,
  }));
};

export const clearAll = () => {
  notificationStore.setState(() => ({ notifications: [], unreadCount: 0 }));
};

export const removeNotification = (id: string) => {
  notificationStore.setState((state) => {
    const notification = state.notifications.find((n) => n.id === id);
    const wasUnread = notification ? !notification.read : false;

    return {
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
    };
  });
};
