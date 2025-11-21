import React from "react";
import { cn } from "@/lib/utils";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
}

export default function Checkbox({ label, className, ...props }: CheckboxProps) {
  return (
    <label className={cn("flex items-center gap-3 text-xs font-medium text-base-content/70 cursor-pointer", className)}>
      <input type="checkbox" className="checkbox checkbox-primary checkbox-sm rounded-md" {...props} />
      {label && <span>{label}</span>}
    </label>
  );
}
