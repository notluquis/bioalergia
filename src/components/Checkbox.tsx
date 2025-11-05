import React from "react";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function Checkbox({ label, className = "", ...props }: CheckboxProps) {
  return (
    <label className={`flex items-center gap-3 text-xs font-medium text-base-content/70 ${className}`.trim()}>
      <input type="checkbox" className="checkbox checkbox-primary" {...props} />
      {label}
    </label>
  );
}
