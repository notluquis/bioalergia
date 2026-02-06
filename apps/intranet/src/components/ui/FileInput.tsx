import { Label } from "@heroui/react";
import { Upload } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
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
    <div className="flex w-full flex-col gap-3">
      {label && <Label className="font-semibold text-sm uppercase tracking-wide">{label}</Label>}
      <section
        aria-label="Área de carga de archivos"
        className={cn(
          "group relative flex min-h-32 w-full flex-col items-center justify-center gap-3 rounded-large border-2 border-default-300 border-dashed bg-default-50 p-6 transition-all duration-200",
          isDragActive && "scale-[1.01] border-primary bg-primary-50/30",
          !props.disabled && "hover:border-default-400 hover:bg-default-100",
          props.disabled && "cursor-not-allowed opacity-50",
          className,
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Upload
          className={cn(
            "h-10 w-10 text-default-400 transition-all duration-200",
            isDragActive && "scale-110 text-primary",
            !props.disabled && "group-hover:scale-105 group-hover:text-default-500",
          )}
        />
        <div className="flex flex-col items-center gap-2 text-center">
          <p
            className={cn(
              "font-medium text-default-700 text-sm transition-colors",
              isDragActive && "text-primary",
            )}
          >
            {isDragActive
              ? "Suelta los archivos aquí"
              : multiple
                ? "Arrastra archivos aquí"
                : "Arrastra un archivo aquí"}
          </p>
          <p className="text-default-500 text-xs">
            {props.accept ? `Formatos: ${props.accept}` : "Todos los formatos"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClick}
          isDisabled={props.disabled}
          startContent={<Upload className="h-4 w-4" />}
        >
          Seleccionar archivos
        </Button>
        {/* Hidden native input - required for file upload functionality */}
        <input ref={inputRef} className="hidden" multiple={multiple} type="file" {...props} />
      </section>
    </div>
  );
}
