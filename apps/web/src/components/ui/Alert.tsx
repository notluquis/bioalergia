/**
 * Alert Component - Native HTML with DaisyUI styling
 *
 * Simple alert component with variant support.
 */
import type React from "react";

import { cn } from "@/lib/utils";

import Button from "./Button";

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
  const variantMap = {
    error: "alert-error text-white",
    info: "alert-info text-white",
    success: "alert-success text-white",
    warning: "alert-warning text-black",
  };

  return (
    // eslint-disable-next-line security/detect-object-injection
    <div className={cn("alert rounded-2xl shadow-lg", variantMap[variant], className)} role="alert">
      <div className="flex flex-1 items-center gap-2">{children}</div>
      {onClose && (
        <div className="flex-none">
          <Button
            aria-label="Cerrar"
            className="btn-circle btn-xs border-none bg-white/20 text-current hover:bg-white/30"
            onClick={onClose}
            size="sm"
            variant="ghost"
          >
            ✕
          </Button>
        </div>
      )}
    </div>
  );
}
