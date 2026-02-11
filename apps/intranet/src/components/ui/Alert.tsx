/**
 * Alert Component - Adapter for HeroUI Alert
 */
import { Button, Alert as HeroAlert } from "@heroui/react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

interface AlertProps extends Omit<ComponentProps<typeof HeroAlert>, "color" | "variant"> {
  children: ComponentProps<typeof HeroAlert>["children"];
  onClose?: () => void;
  status?: "accent" | "danger" | "default" | "success" | "warning";
}
export function Alert({
  children,
  onClose,
  status = "default",
  className,
  ...props
}: Readonly<AlertProps>) {
  return (
    <HeroAlert className={cn("relative items-start", className)} status={status} {...props}>
      <div className="mr-6 flex-1">{children}</div>
      {onClose && (
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={onClose}
          aria-label="Cerrar"
          className="absolute top-2 right-2 h-6 w-6 min-w-6 data-[hover=true]:bg-black/10 dark:data-[hover=true]:bg-white/10"
        >
          ✕
        </Button>
      )}
    </HeroAlert>
  );
}
