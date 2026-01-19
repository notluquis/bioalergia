/**
 * Checkbox Component - Native HTML with HeroUI-inspired styling
 *
 * Using native HTML checkbox for full API compatibility.
 */
import type React from "react";

import { cn } from "@/lib/utils";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
}

export default function Checkbox({ className, label, ...props }: Readonly<CheckboxProps>) {
  return (
    <label
      className={cn(
        "text-base-content/70 flex cursor-pointer items-center gap-3 text-xs font-medium",
        className,
      )}
    >
      <input
        className="checkbox checkbox-primary checkbox-sm rounded-md"
        type="checkbox"
        {...props}
      />
      {label && <span>{label}</span>}
    </label>
  );
}
