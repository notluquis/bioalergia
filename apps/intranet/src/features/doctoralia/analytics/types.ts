export type DoctoraliaMetricKey = "total" | "programmed" | "cancelled" | "attended" | "noShow";

export interface DoctoraliaMonthlyChartDatum {
  readonly month: string;
  readonly programmed: number;
  readonly cancelled: number;
  readonly attended: number;
  readonly noShow: number;
  readonly total: number;
  readonly cancellationRate: number;
}

export interface DoctoraliaYearlyTotals {
  readonly programmed: number;
  readonly cancelled: number;
  readonly attended: number;
  readonly noShow: number;
  readonly total: number;
  readonly cancellationRate: number;
}

export type DoctoraliaComparisonChartDatum = {
  readonly month: string;
} & Record<string, number | string>;

export const DOCTORALIA_METRIC_LABELS: Record<DoctoraliaMetricKey, string> = {
  total: "Total",
  programmed: "Programadas",
  cancelled: "Canceladas",
  attended: "Atendidas",
  noShow: "No-show",
};

export const DOCTORALIA_CHART_COLORS = {
  programmed: "#3b82f6",
  cancelled: "#ef4444",
  attended: "#10b981",
  noShow: "#f59e0b",
  total: "#8b5cf6",
  cancellationRate: "#f97316",
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
