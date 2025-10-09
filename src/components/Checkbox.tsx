import React from "react";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Checkbox({ label, className = "", ...props }: CheckboxProps) {
  return (
    <label className={`flex items-center gap-3 text-xs font-medium text-slate-600/90 ${className}`.trim()}>
      <input
        type="checkbox"
        className="glass-toggle h-4 w-4 rounded border border-white/60 bg-white/70 text-[var(--brand-primary)] outline-none transition-all focus-visible:border-[var(--brand-primary)] focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb)/0.25)]"
        {...props}
      />
      {label}
    </label>
  );
}
