import React from "react";

interface AlertProps {
  variant?: "error" | "success" | "warning" | "info";
  children: React.ReactNode;
  className?: string;
}

export default function Alert({ variant = "error", children, className = "" }: AlertProps) {
  const baseClasses = "glass-card border-l-4 px-5 py-4 text-sm";

  const variantClasses: Record<Required<AlertProps>["variant"], string> = {
    error: "border-rose-300/80 text-rose-700 bg-gradient-to-r from-rose-50/65 via-white/70 to-white/55",
    success: "border-emerald-300/80 text-emerald-700 bg-gradient-to-r from-emerald-50/70 via-white/70 to-white/55",
    warning: "border-amber-300/80 text-amber-700 bg-gradient-to-r from-amber-50/70 via-white/70 to-white/55",
    info: "border-sky-300/80 text-sky-700 bg-gradient-to-r from-sky-50/70 via-white/70 to-white/55",
  };

  return <p className={`${baseClasses} ${variantClasses[variant]} ${className}`.trim()}>{children}</p>;
}
