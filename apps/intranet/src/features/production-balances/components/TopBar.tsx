import { Button } from "@heroui/react";
import { Save } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

import type { DayStatus } from "../types";

import { formatDateFull } from "../utils";

interface TopBarProps {
  date: Date;
  isSaving: boolean;
  onSave: () => Promise<void> | void;
  status: DayStatus;
}

/**
 * Compact sticky bar with current date, status, and save action
 */
export function TopBar({ date, isSaving, onSave, status }: TopBarProps) {
  // Keyboard shortcut: ⌘S / Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void onSave();
      }
    };
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [onSave]);

  const statusLabels: Record<DayStatus, string> = {
    balanced: "Cuadra",
    draft: "Borrador",
    empty: "Vacío",
    unbalanced: "Pendiente",
  };

  const statusColors: Record<DayStatus, string> = {
    balanced: "bg-success/15 text-success",
    draft: "bg-warning/15 text-warning",
    empty: "bg-default-100/80 text-default-500",
    unbalanced: "bg-amber-500/15 text-amber-400",
  };

  return (
    <div className="sticky top-0 z-10 mb-3 rounded-2xl border border-default-100 bg-background/90 px-4 py-3 backdrop-blur-md sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-default-900 text-lg capitalize sm:text-xl">
            {formatDateFull(date)}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={cn("rounded-full px-2 py-0.5 font-medium text-xs", statusColors[status])}
            >
              {statusLabels[status]}
            </span>
          </div>
        </div>

        <Button
          className="shrink-0 gap-2 rounded-xl px-4"
          isPending={isSaving}
          onPress={onSave}
          size="sm"
          variant="primary"
        >
          <Save className="size-4" />
          {isSaving ? "Guardando..." : "Guardar"}
          <kbd className="ml-1 hidden rounded bg-black/10 px-1.5 py-0.5 text-[10px] sm:inline">
            ⌘S
          </kbd>
        </Button>
      </div>
    </div>
  );
}
