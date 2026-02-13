import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
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
  const zenstackInfo =
    typeof error === "object" && error !== null && "info" in error
      ? (error as { info?: unknown }).info
      : null;

  const zenstackMessage =
    zenstackInfo &&
    typeof zenstackInfo === "object" &&
    "message" in zenstackInfo &&
    typeof (zenstackInfo as { message?: unknown }).message === "string"
      ? (zenstackInfo as { message: string }).message
      : null;

  const zenstackDetails =
    zenstackInfo && !zenstackMessage ? JSON.stringify(zenstackInfo, null, 2) : null;

  const errorMessage =
    zenstackMessage ??
    zenstackDetails ??
    (error instanceof Error ? error.message : typeof error === "string" ? error : null);

  return (
    <div
      className={cn(
        "flex min-h-50 w-full flex-col items-center justify-center rounded-xl border border-danger-200 border-dashed bg-danger-50/10 p-6 text-center text-default-600",
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-100 text-danger">
        <AlertTriangle className="h-6 w-6" />
      </div>

      <span className="mb-2 block font-semibold text-lg">{title}</span>
      <span className="mb-6 block max-w-md text-sm">{message}</span>

      {errorMessage && (
        <div className="mb-6 w-full max-w-md overflow-hidden rounded-lg bg-default-50 p-2 text-left">
          <code className="block whitespace-pre-wrap break-all font-mono text-danger text-xs">
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
