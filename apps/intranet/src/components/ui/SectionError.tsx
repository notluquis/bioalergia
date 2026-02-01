import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface SectionErrorProps {
  title?: string;
  message?: string;
  error?: Error | unknown;
  onRetry?: () => void;
  className?: string;
  children?: ReactNode;
}

export function SectionError({
  title = "No pudimos cargar esta sección",
  message = "Ocurrió un error al obtener los datos. Por favor, intenta nuevamente.",
  error,
  onRetry,
  className,
  children,
}: Readonly<SectionErrorProps>) {
  const errorMessage =
    error instanceof Error ? error.message : typeof error === "string" ? error : null;

  return (
    <div
      className={cn(
        "flex min-h-50 w-full flex-col items-center justify-center rounded-xl border border-dashed border-danger-200 bg-danger-50/10 p-6 text-center text-default-600",
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-100 text-danger">
        <AlertTriangle className="h-6 w-6" />
      </div>

      <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mb-6 max-w-md text-sm text-default-500">{message}</p>

      {errorMessage && (
        <div className="mb-6 w-full max-w-md overflow-hidden rounded-lg bg-default-50 p-2 text-left">
          <code className="block font-mono text-xs text-danger break-all whitespace-pre-wrap">
            {errorMessage}
          </code>
        </div>
      )}

      {children}

      {onRetry && (
        <Button
          onClick={onRetry}
          variant="ghost"
          className="gap-2 text-danger hover:text-danger-600"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      )}
    </div>
  );
}
