import React from "react";
import { cn } from "@/lib/utils";

interface FileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function FileInput({ label, className, ...props }: FileInputProps) {
  return (
    <label className="flex w-full flex-col gap-2">
      {label && (
        <span className="text-xs font-semibold uppercase tracking-wide text-base-content/70 ml-1">{label}</span>
      )}
      <input type="file" className={cn("file-input file-input-bordered w-full text-sm", className)} {...props} />
    </label>
  );
}
