export type DoctoraliaMetricKey = "total" | "bookings" | "modifications" | "cancellations";

export interface DoctoraliaMonthlyChartDatum {
  readonly month: string;
  readonly bookings: number;
  readonly modifications: number;
  readonly cancellations: number;
  readonly total: number;
  readonly cancellationRate: number;
}

export interface DoctoraliaYearlyTotals {
  readonly bookings: number;
  readonly modifications: number;
  readonly cancellations: number;
  readonly total: number;
  readonly cancellationRate: number;
}

export type DoctoraliaComparisonChartDatum = {
  readonly month: string;
} & Record<string, number | string>;

export const DOCTORALIA_METRIC_LABELS: Record<DoctoraliaMetricKey, string> = {
  total: "Total",
  bookings: "Reservas",
  modifications: "Modificaciones",
  cancellations: "Cancelaciones",
};

export const DOCTORALIA_CHART_COLORS = {
  bookings: "#10b981",
  modifications: "#3b82f6",
  cancellations: "#ef4444",
  total: "#8b5cf6",
  cancellationRate: "#f59e0b",
} as const;

export const DOCTORALIA_COMPARISON_LINE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
] as const;

export const DOCTORALIA_CHART_THEME = {
  axis: "#94a3b8",
  grid: "#334155",
  legend: "#cbd5e1",
  tooltipBackground: "rgba(15, 23, 42, 0.94)",
  tooltipBorder: "#334155",
  tooltipLabel: "#f8fafc",
  tooltipValue: "#e2e8f0",
} as const;
