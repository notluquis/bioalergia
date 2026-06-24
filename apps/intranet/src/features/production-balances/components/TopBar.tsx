import { Button, Kbd } from "@heroui/react";
import { Lock, Save } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

import { DAY_STATUS_CHIP_CLASSES, DAY_STATUS_LABELS } from "../labels";
import type { DayStatus } from "../types";

import { formatDateFull } from "../utils";

interface TopBarProps {
  date: Date;
  isFinalized: boolean;
  isSaving: boolean;
  onSave: () => Promise<void> | void;
  status: DayStatus;
}

/**
 * Compact sticky bar with current date, status, and save action
 */
export function TopBar({ date, isFinalized, isSaving, onSave, status }: TopBarProps) {
  // Keyboard shortcut: ⌘S / Ctrl+S
  useEffect(() => {
    if (isFinalized) {
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void onSave();
      }
    };
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFinalized, onSave]);

  return (
    <div className="sticky top-0 z-10 mb-3 rounded-[28px] border border-default-100 bg-background/90 px-4 py-3 backdrop-blur-md sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-semibold text-default-900 text-lg capitalize sm:text-xl">
            {formatDateFull(date)}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs",
                DAY_STATUS_CHIP_CLASSES[status]
              )}
            >
              {isFinalized && <Lock aria-hidden="true" className="size-3" />}
              {DAY_STATUS_LABELS[status]}
            </span>
          </div>
        </div>

        {!isFinalized && (
          <Button
            className="h-11 w-full shrink-0 gap-2 rounded-2xl px-4 sm:w-auto"
            isPending={isSaving}
            onPress={() => {
              void onSave();
            }}
            size="sm"
            variant="primary"
          >
            <Save aria-hidden="true" className="size-4" />
            {isSaving ? "Guardando..." : "Guardar"}
            <Kbd className="ml-1 hidden sm:inline-flex" variant="light">
              <Kbd.Abbr keyValue="command" />
              <Kbd.Content>S</Kbd.Content>
            </Kbd>
          </Button>
        )}
      </div>
    </div>
  );
}
