import { Upload } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface FileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  multiple?: boolean;
}

export function FileInput({ className, label, multiple, ...props }: Readonly<FileInputProps>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (props.disabled) {
      return;
    }

    const files = e.dataTransfer.files;
    if (files && inputRef.current) {
      // Create a new DataTransfer to assign files to the input
      const dataTransfer = new DataTransfer();
      for (const file of Array.from(files)) {
        dataTransfer.items.add(file);
      }
      inputRef.current.files = dataTransfer.files;

      // Trigger onChange event
      const event = new Event("change", { bubbles: true });
      inputRef.current.dispatchEvent(event);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="flex w-full flex-col gap-2">
      {label && (
        <span className="ml-1 font-semibold text-default-600 text-xs uppercase tracking-wide">
          {label}
        </span>
      )}
      <button
        type="button"
        className={cn(
          "relative flex min-h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-default-300 border-dashed bg-default-50/50 px-6 py-8 text-left transition-colors hover:border-default-400 hover:bg-default-100/50",
          isDragActive && "border-primary bg-primary/5",
          props.disabled && "cursor-not-allowed opacity-50",
          className,
        )}
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        disabled={props.disabled}
      >
        <Upload
          className={cn(
            "h-8 w-8 text-default-400",
            isDragActive && "text-primary",
            props.disabled && "text-default-300",
          )}
        />
        <div className="text-center">
          <p className="font-medium text-default-700 text-sm">
            {isDragActive
              ? "Suelta los archivos aquí"
              : multiple
                ? "Arrastra archivos aquí o haz clic para seleccionar"
                : "Arrastra un archivo aquí o haz clic para seleccionar"}
          </p>
          <p className="mt-1 text-default-500 text-xs">
            {props.accept ? `Formatos aceptados: ${props.accept}` : "Todos los formatos"}
          </p>
        </div>
        <input ref={inputRef} className="hidden" multiple={multiple} type="file" {...props} />
      </button>
    </div>
  );
}
