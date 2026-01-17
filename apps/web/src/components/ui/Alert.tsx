/**
 * Alert Component - Native HTML with DaisyUI styling
 *
 * Simple alert component with variant support.
 */
import type React from "react";

import { cn } from "@/lib/utils";

import Button from "./Button";

interface AlertProps {
  variant?: "error" | "success" | "warning" | "info";
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

export default function Alert({ variant = "error", children, className = "", onClose }: AlertProps) {
  const variantMap = {
    error: "alert-error text-white",
    success: "alert-success text-white",
    warning: "alert-warning text-black",
    info: "alert-info text-white",
  };

  return (
    <div className={cn("alert rounded-2xl shadow-lg", variantMap[variant], className)} role="alert">
      <div className="flex flex-1 items-center gap-2">{children}</div>
      {onClose && (
        <div className="flex-none">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Cerrar"
            onClick={onClose}
            className="btn-circle btn-xs border-none bg-white/20 text-current hover:bg-white/30"
          >
            ✕
          </Button>
        </div>
      )}
    </div>
  );
}
