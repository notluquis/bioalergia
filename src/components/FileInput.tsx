import React from "react";

interface FileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function FileInput({ label, ...props }: FileInputProps) {
  return (
    <label className="flex w-full flex-col gap-2">
      {label && <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</span>}
      <input
        type="file"
        {...props}
        className={`file-input file-input-bordered w-full ${props.className || ''}`}
      />
    </label>
  );
}
