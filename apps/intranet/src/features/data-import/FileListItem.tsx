import { Chip } from "@heroui/react";
import { AlertCircle, CheckCircle2, FileText, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { formatFileSize } from "@/lib/format";

export type FileStatus =
  | "idle"
  | "parsing"
  | "ready"
  | "previewing"
  | "importing"
  | "success"
  | "error";

interface FileListItemProps {
  file: File;
  id: string;
  onRemove?: (id: string) => void;
  progress?: number;
  rowCount?: number;
  status: FileStatus;
  statusMessage?: string;
}

const STATUS_CONFIG: Record<
  FileStatus,
  {
    color: "accent" | "danger" | "default" | "success" | "warning";
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }
> = {
  error: {
    color: "danger",
    icon: AlertCircle,
    label: "Error",
  },
  idle: {
    color: "default",
    icon: FileText,
    label: "En cola",
  },
  importing: {
    color: "accent",
    icon: Loader2,
    label: "Importando",
  },
  parsing: {
    color: "accent",
    icon: Loader2,
    label: "Procesando",
  },
  previewing: {
    color: "accent",
    icon: Loader2,
    label: "Previsualizando",
  },
  ready: {
    color: "success",
    icon: CheckCircle2,
    label: "Listo",
  },
  success: {
    color: "success",
    icon: CheckCircle2,
    label: "Completado",
  },
};

export function FileListItem({
  file,
  id,
  onRemove,
  progress,
  rowCount,
  status,
  statusMessage,
}: FileListItemProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const showProgress = status === "importing" || status === "previewing" || status === "parsing";
  const canRemove = status === "idle" || status === "ready" || status === "error";

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-default-200 bg-background p-3 transition-all hover:border-default-300 hover:shadow-sm">
      {/* Icon */}
      <div className="shrink-0">
        <Icon
          className={`h-5 w-5 ${showProgress ? "animate-spin" : ""} ${
            status === "error" ? "text-danger" : "text-default-500"
          }`}
        />
      </div>

      {/* File Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-sm">{file.name}</p>
          <Chip size="sm" variant="soft" color={config.color}>
            {config.label}
          </Chip>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-default-500 text-xs">
          <span>{formatFileSize(file.size)}</span>
          {rowCount !== undefined && (
            <>
              <span>•</span>
              <span>{rowCount} filas</span>
            </>
          )}
          {statusMessage && (
            <>
              <span>•</span>
              <span className={status === "error" ? "text-danger" : ""}>{statusMessage}</span>
            </>
          )}
        </div>

        {/* Progress Bar */}
        {showProgress && progress !== undefined && (
          <div className="mt-2">
            <div className="h-1 w-full overflow-hidden rounded-full bg-default-200">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progreso"
              />
            </div>
          </div>
        )}
      </div>

      {/* Remove Button */}
      {canRemove && onRemove && (
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          onClick={() => onRemove(id)}
          className="opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Eliminar archivo"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
