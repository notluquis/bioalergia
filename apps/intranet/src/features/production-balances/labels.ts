import type { DayStatus } from "./types";

export const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  draft: "Borrador",
  empty: "Vacío",
  finalized: "Finalizado",
  unbalanced: "No cuadra",
};

/** Chip de estado (TopBar / CierrePanel). */
export const DAY_STATUS_CHIP_CLASSES: Record<DayStatus, string> = {
  draft: "bg-warning/15 text-warning",
  empty: "bg-default-100 text-default-500",
  finalized: "bg-success/15 text-success",
  unbalanced: "bg-danger/15 text-danger",
};

/** Dot sólido del WeekStrip. */
export const DAY_STATUS_DOT_CLASSES: Record<DayStatus, string> = {
  draft: "bg-warning",
  empty: "bg-default-200",
  finalized: "bg-success",
  unbalanced: "bg-danger",
};
