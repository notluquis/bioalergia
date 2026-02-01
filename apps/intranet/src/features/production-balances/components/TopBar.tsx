import { Button } from "@heroui/react";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import type { DayStatus } from "../types";

import { formatDateFull } from "../utils";

interface TopBarProps {
  canFinalize: boolean;
  date: Date;
  isSaving: boolean;
  onFinalize: () => void;
  onSave: () => void;
  status: DayStatus;
}

/**
 * Sticky top bar with date, status, and action buttons
 */
export function TopBar({ canFinalize, date, isSaving, onFinalize, onSave, status }: TopBarProps) {
  const [showShortcut, setShowShortcut] = useState(false);

  // Keyboard shortcut: ⌘S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        onSave();
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
    balanced: "bg-success/20 text-success",
    draft: "bg-warning/20 text-warning",
    empty: "bg-default-100 text-default-500",
    unbalanced: "bg-amber-500/20 text-amber-400",
  };

  return (
    <div className="bg-background/80 border-default-100 sticky top-0 z-10 mb-4 flex items-center justify-between rounded-2xl border px-6 py-4 backdrop-blur-md">
      {/* Left: Title and date */}
      <div>
        <h1 className="text-xl font-bold">Balance diario</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-default-700 text-lg font-medium capitalize">
            {formatDateFull(date)}
          </span>
          <span
            className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusColors[status])}
          >
            {statusLabels[status]}
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Save button with shortcut hint */}
        <Button
          className="gap-2 rounded-xl"
          isPending={isSaving}
          onPress={onSave}
          onMouseEnter={() => {
            setShowShortcut(true);
          }}
          onMouseLeave={() => {
            setShowShortcut(false);
          }}
          size="sm"
          variant="ghost"
        >
          <Save className="size-4" />
          <span className="hidden sm:inline">Guardar</span>
          {showShortcut && (
            <kbd className="bg-default-100 ml-1 hidden rounded px-1.5 py-0.5 text-xs sm:inline">
              ⌘S
            </kbd>
          )}
        </Button>

        {/* Finalizar button */}
        <Button
          className={cn(
            "rounded-xl px-6",
            canFinalize && "bg-success text-success-foreground hover:bg-success/90",
          )}
          isDisabled={!canFinalize || isSaving}
          onPress={onFinalize}
        >
          Finalizar
        </Button>

        {/* More options dropdown */}
      </div>
    </div>
  );
}
