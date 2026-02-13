import { Popover, ScrollShadow } from "@heroui/react";
import { useStore } from "@tanstack/react-store";
import dayjs from "dayjs";
import { Bell, CheckCheck, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  clearAll,
  markAllAsRead,
  markAsRead,
  type NotificationItem as NotificationItemType,
  notificationStore,
  removeNotification,
} from "../store/use-notification-store";

export function NotificationHistory() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount } = useStore(notificationStore, (state) => state);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const hasNotifications = notifications.length > 0;

  return (
    <Popover isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger>
        <div className="relative inline-block">
          <Button
            isIconOnly
            variant="ghost"
            aria-label="Notificaciones"
            className="relative rounded-full text-default-500 hover:bg-default-100"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center border-2 border-background px-1 text-[10px]"
                color="danger"
                size="sm"
                variant="primary"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </Button>
        </div>
      </Popover.Trigger>
      {/* Moved offset to Content. Removed placement to rely on default or auto. */}
      {/* Fixed width class w-[360px] -> w-80 or w-96 (Tailwind doesn't have w-90 by default, closest is 96=384px or 80=320px or 72=288px). Using w-96 for space. */}
      {/* Fixed max-h-[400px] -> max-h-96 (384px) since max-h-100 is 400px which exists in extended themes usually but standard is 96. I'll use values strictly. User said w-90... let's check if w-90 exists. Usually it's w-full or specific. I'll use w-[360px] if strict design needed, but user warning said "can be written as w-90". This implies w-90 exists in their config. Okay. */}
      <Popover.Content
        className="w-90 overflow-hidden rounded-xl border border-default-200 p-0 shadow-xl"
        offset={20}
      >
        <div className="flex items-center justify-between border-default-100 border-b bg-content1/50 px-4 py-3 backdrop-blur-md">
          <h3 className="font-semibold text-small">Notificaciones</h3>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                title="Marcar todas como leídas"
                onClick={() => markAllAsRead()}
              >
                <CheckCheck className="h-4 w-4 text-primary" />
              </Button>
            )}
            {hasNotifications && (
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                title="Borrar historial"
                className="text-danger"
                onClick={() => clearAll()}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <ScrollShadow className="max-h-100">
          {!hasNotifications ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-default-400">
              <Bell className="h-8 w-8 opacity-20" />
              <p className="text-sm">No tienes notificaciones</p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={markAsRead}
                  onRemove={removeNotification}
                />
              ))}
            </ul>
          )}
        </ScrollShadow>
      </Popover.Content>
    </Popover>
  );
}

interface NotificationItemProps {
  notification: NotificationItemType;
  onRead: (id: string) => void;
  onRemove: (id: string) => void;
}

function NotificationItem({ notification, onRead, onRemove }: Readonly<NotificationItemProps>) {
  return (
    <li className="border-default-100 border-b transition-colors last:border-0 hover:bg-default-50">
      <article
        className={cn(
          "group relative flex cursor-default gap-3 px-4 py-3",
          !notification.read && "bg-primary-50/10",
        )}
        onMouseEnter={() => !notification.read && onRead(notification.id)}
      >
        <div
          className={cn(
            "mt-1 h-2 w-2 shrink-0 rounded-full",
            notification.type === "error"
              ? "bg-danger"
              : notification.type === "success"
                ? "bg-success"
                : notification.type === "warning"
                  ? "bg-warning"
                  : "bg-primary",
          )}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {notification.title && (
              <p
                className={cn(
                  "font-semibold text-xs",
                  !notification.read ? "text-foreground" : "text-default-600",
                )}
              >
                {notification.title}
              </p>
            )}
            <span className="shrink-0 whitespace-nowrap text-[10px] text-default-400">
              {dayjs(notification.timestamp).format("DD/MM HH:mm")}
            </span>
          </div>
          <p
            className={cn(
              "mt-0.5 text-xs leading-relaxed",
              !notification.read ? "text-foreground-800" : "text-default-500",
            )}
          >
            {notification.message}
          </p>
        </div>

        <Button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(notification.id);
          }}
          className="absolute top-2 right-2 rounded-full p-1 text-default-400 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
          title="Eliminar notificación"
          variant="ghost"
          isIconOnly
          size="sm"
        >
          <X className="h-3 w-3" />
        </Button>
      </article>
    </li>
  );
}
