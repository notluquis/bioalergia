import { Button } from "@heroui/react";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";

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
 * Sticky top bar with date, status, and action buttons
 */
export function TopBar({ date, isSaving, onSave, status }: TopBarProps) {
  const [showShortcut, setShowShortcut] = useState(false);

  // Keyboard shortcut: ⌘S to save
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
    balanced: "bg-success/20 text-success",
    draft: "bg-warning/20 text-warning",
    empty: "bg-default-100 text-default-500",
    unbalanced: "bg-amber-500/20 text-amber-400",
  };

  return (
    <div className="sticky top-0 z-10 mb-4 flex items-center justify-between rounded-2xl border border-default-100 bg-background/80 px-6 py-4 backdrop-blur-md">
      {/* Left: Title and date */}
      <div>
        <h1 className="font-bold text-xl">Balance diario</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-medium text-default-700 text-lg capitalize">
            {formatDateFull(date)}
          </span>
          <span
            className={cn("rounded-full px-2 py-0.5 font-medium text-xs", statusColors[status])}
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
            <kbd className="ml-1 hidden rounded bg-default-100 px-1.5 py-0.5 text-xs sm:inline">
              ⌘S
            </kbd>
          )}
        </Button>
      </div>
    </div>
  );
}
