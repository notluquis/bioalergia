import React from "react";
import Button from "./Button";

interface AlertProps {
  variant?: "error" | "success" | "warning" | "info";
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

export default function Alert({ variant = "error", children, className = "", onClose }: AlertProps) {
  // Map to daisyUI alert variants. Use DaisyUI tokens (card, btn, bg-base-100) for visuals.
  const variantMap: Record<Required<AlertProps>["variant"], string> = {
    error: "alert-error",
    success: "alert-success",
    warning: "alert-warning",
    info: "alert-info",
  };

  return (
    <div className={`alert ${variantMap[variant]} px-4 py-3 text-sm ${className}`.trim()} role="alert">
      <div className="flex-1">{children}</div>
      {onClose && (
        <div className="flex-none">
          <Button variant="secondary" size="sm" aria-label="Cerrar" onClick={onClose}>
            ✕
          </Button>
        </div>
      )}
    </div>
  );
}
