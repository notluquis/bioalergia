import type React from "react";

import { cn } from "@/lib/utils";

interface FileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  multiple?: boolean;
}
export function FileInput({ className, label, multiple, ...props }: Readonly<FileInputProps>) {
  return (
    <label className="flex w-full cursor-pointer flex-col gap-2">
      {label && (
        <span className="ml-1 font-semibold text-default-600 text-xs uppercase tracking-wide">
          {label}
        </span>
      )}
      <input
        className={cn("file-input file-input-bordered w-full text-sm", className)}
        multiple={multiple}
        type="file"
        {...props}
      />
    </label>
  );
}
