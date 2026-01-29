import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type NotificationType = "success" | "error" | "info" | "warning";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  timestamp: number;
  read: boolean;
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;

  // Actions
  addNotification: (notification: Omit<NotificationItem, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [],
      unreadCount: 0,

      addNotification: (notification) =>
        set((state) => {
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
        }),

      markAsRead: (id) =>
        set((state) => {
          const notification = state.notifications.find((n) => n.id === id);
          if (!notification || notification.read) return state;

          return {
            notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
            unreadCount: Math.max(0, state.unreadCount - 1),
          };
        }),

      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),

      clearAll: () => set({ notifications: [], unreadCount: 0 }),

      removeNotification: (id) =>
        set((state) => {
          const notification = state.notifications.find((n) => n.id === id);
          const wasUnread = notification ? !notification.read : false;

          return {
            notifications: state.notifications.filter((n) => n.id !== id),
            unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
          };
        }),
    }),
    {
      name: "bioalergia-notification-history",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
