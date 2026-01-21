/**
 * Alert Component - Adapter for HeroUI Alert
 */
import { Button, Alert as HeroAlert } from "@heroui/react";
import type React from "react";

import { cn } from "@/lib/utils";

interface AlertProps {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
  variant?: "error" | "info" | "success" | "warning";
}

export default function Alert({
  children,
  className = "",
  onClose,
  variant = "error",
}: Readonly<AlertProps>) {
  const colorMap = {
    error: "danger",
    info: "primary", // HeroUI uses primary/secondary for info-like states usually, or we can use "primary"
    success: "success",
    warning: "warning",
  } as const;

  return (
    <HeroAlert className={cn("items-start relative", className)} color={colorMap[variant]}>
      <div className="flex-1 mr-6">{children}</div>
      {onClose && (
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={onClose}
          aria-label="Cerrar"
          className="absolute right-2 top-2 min-w-6 w-6 h-6 data-[hover=true]:bg-black/10 dark:data-[hover=true]:bg-white/10"
        >
          ✕
        </Button>
      )}
    </HeroAlert>
  );
}
