import type React from "react";

import { cn } from "@/lib/utils";

interface FileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function FileInput({ className, label, ...props }: Readonly<FileInputProps>) {
  return (
    <label className="flex w-full flex-col gap-2">
      {label && (
        <span className="text-base-content/70 ml-1 text-xs font-semibold tracking-wide uppercase">
          {label}
        </span>
      )}
      <input
        className={cn("file-input file-input-bordered w-full text-sm", className)}
        type="file"
        {...props}
      />
    </label>
  );
}
