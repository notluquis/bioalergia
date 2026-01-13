import { ChevronDown, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import type { DayStatus } from "../types";
import { formatDateFull } from "../utils";

interface TopBarProps {
  date: string;
  status: DayStatus;
  isSaving: boolean;
  onSave: () => void;
  onFinalize: () => void;
  canFinalize: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}

/**
 * Sticky top bar with date, status, and action buttons
 */
export function TopBar({
  date,
  status,
  isSaving,
  onSave,
  onFinalize,
  canFinalize,
  onPrevWeek,
  onNextWeek,
}: TopBarProps) {
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
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [onSave]);

  const statusLabels: Record<DayStatus, string> = {
    empty: "Vacío",
    draft: "Borrador",
    balanced: "Cuadra",
    unbalanced: "Pendiente",
  };

  const statusColors: Record<DayStatus, string> = {
    empty: "bg-base-content/10 text-base-content/60",
    draft: "bg-warning/20 text-warning",
    balanced: "bg-success/20 text-success",
    unbalanced: "bg-amber-500/20 text-amber-400",
  };

  return (
    <header className="bg-base-100/80 border-base-content/5 sticky top-0 z-10 mb-4 flex items-center justify-between rounded-2xl border px-6 py-4 backdrop-blur-md">
      {/* Left: Title and date */}
      <div>
        <h1 className="text-xl font-bold">Balance diario</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-base-content/80 text-lg font-medium capitalize">{formatDateFull(date)}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", statusColors[status])}>
            {statusLabels[status]}
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Save button with shortcut hint */}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          onMouseEnter={() => setShowShortcut(true)}
          onMouseLeave={() => setShowShortcut(false)}
          className={cn("btn btn-ghost btn-sm gap-2 rounded-xl", isSaving && "loading")}
        >
          {!isSaving && <Save className="size-4" />}
          <span className="hidden sm:inline">Guardar</span>
          {showShortcut && (
            <kbd className="bg-base-content/10 ml-1 hidden rounded px-1.5 py-0.5 text-xs sm:inline">⌘S</kbd>
          )}
        </button>

        {/* Finalizar button */}
        <button
          type="button"
          onClick={onFinalize}
          disabled={!canFinalize || isSaving}
          className={cn("btn rounded-xl px-6", canFinalize ? "btn-success" : "btn-disabled")}
        >
          Finalizar
        </button>

        {/* More options dropdown */}
        <div className="dropdown dropdown-end">
          <button type="button" className="btn btn-ghost btn-sm btn-square rounded-xl">
            <ChevronDown className="size-4" />
          </button>
          <ul className="dropdown-content bg-base-200 border-base-content/10 menu z-10 w-52 rounded-xl border p-2 shadow-lg">
            <li>
              <button type="button" className="text-sm" onClick={onPrevWeek}>
                Ver anterior semana
              </button>
            </li>
            <li>
              <button type="button" className="text-sm" onClick={onNextWeek}>
                Ver siguiente semana
              </button>
            </li>
            <li>
              <button type="button" className="text-sm">
                Exportar día
              </button>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
