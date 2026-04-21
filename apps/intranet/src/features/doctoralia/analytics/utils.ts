import type { DoctoraliaCalendarMonthlySummaryPeriod } from "@/features/doctoralia/types";

import type {
  DoctoraliaComparisonChartDatum,
  DoctoraliaMetricKey,
  DoctoraliaMonthlyChartDatum,
  DoctoraliaYearlyTotals,
} from "./types";

export const DOCTORALIA_MONTH_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const;

export type DoctoraliaMonthName = (typeof DOCTORALIA_MONTH_NAMES)[number];

export function getDoctoraliaMonthName(index: number): DoctoraliaMonthName {
  if (index < 0 || index > 11) {
    throw new RangeError(`Month index must be between 0-11, got ${index}`);
  }
  return DOCTORALIA_MONTH_NAMES[index] as DoctoraliaMonthName;
}

export function formatDoctoraliaNumber(value: number): string {
  return new Intl.NumberFormat("es-CL").format(value);
}

export function formatDoctoraliaPercent(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    style: "percent",
  }).format(value);
}

export function buildDoctoraliaMonthlyChartData(
  summary: DoctoraliaCalendarMonthlySummaryPeriod[],
  year: string
): DoctoraliaMonthlyChartDatum[] {
  const monthMap = new Map<string, DoctoraliaCalendarMonthlySummaryPeriod>();
  for (const item of summary) {
    monthMap.set(item.period, item);
  }

  return Array.from({ length: 12 }, (_, i): DoctoraliaMonthlyChartDatum => {
    const month = (i + 1).toString().padStart(2, "0");
    const period = `${year}-${month}`;
    const item = monthMap.get(period);

    return {
      month: getDoctoraliaMonthName(i),
      programmed: item?.programmed ?? 0,
      cancelled: item?.cancelled ?? 0,
      attended: item?.attended ?? 0,
      noShow: item?.noShow ?? 0,
      total: item?.total ?? 0,
      cancellationRate: item?.cancellationRate ?? 0,
    };
  });
}

export function calculateDoctoraliaYearlyTotals(
  data: DoctoraliaMonthlyChartDatum[]
): DoctoraliaYearlyTotals {
  const programmed = data.reduce((sum, d) => sum + d.programmed, 0);
  const cancelled = data.reduce((sum, d) => sum + d.cancelled, 0);
  const attended = data.reduce((sum, d) => sum + d.attended, 0);
  const noShow = data.reduce((sum, d) => sum + d.noShow, 0);
  const total = programmed + cancelled + attended + noShow;
  const cancellationRate = total > 0 ? cancelled / total : 0;
  return { programmed, cancelled, attended, noShow, total, cancellationRate };
}

export function buildDoctoraliaComparisonChartData(
  summary: DoctoraliaCalendarMonthlySummaryPeriod[],
  metric: DoctoraliaMetricKey
): DoctoraliaComparisonChartDatum[] {
  const monthYearMap = new Map<string, Map<string, number>>();

  for (const item of summary) {
    const [year, month] = item.period.split("-");
    if (!year || !month) continue;
    const bucket = monthYearMap.get(month) ?? new Map<string, number>();
    bucket.set(year, item[metric]);
    monthYearMap.set(month, bucket);
  }

  return Array.from({ length: 12 }, (_, i): DoctoraliaComparisonChartDatum => {
    const monthStr = (i + 1).toString().padStart(2, "0");
    const yearMap = monthYearMap.get(monthStr);

    const datum: DoctoraliaComparisonChartDatum = {
      month: getDoctoraliaMonthName(i),
    };

    if (yearMap) {
      for (const [year, value] of yearMap.entries()) {
        datum[year] = value;
      }
    }

    return datum;
  });
}

export function extractDoctoraliaYearsFromSummary(
  summary: DoctoraliaCalendarMonthlySummaryPeriod[]
): string[] {
  const yearSet = new Set<string>();
  for (const item of summary) {
    const year = item.period.split("-")[0];
    if (year) yearSet.add(year);
  }
  return Array.from(yearSet).sort().reverse();
}

export function safeDoctoraliaYearSelection(
  selectedYear: string,
  yearOptions: readonly string[]
): string {
  if (yearOptions.includes(selectedYear)) return selectedYear;
  return yearOptions[0] ?? new Date().getFullYear().toString();
}
