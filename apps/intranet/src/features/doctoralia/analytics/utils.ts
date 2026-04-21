import type { DoctoraliaEmailMonthlySummaryPeriod } from "@/features/doctoralia/types";

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
  summary: DoctoraliaEmailMonthlySummaryPeriod[],
  year: string
): DoctoraliaMonthlyChartDatum[] {
  const monthMap = new Map<string, DoctoraliaEmailMonthlySummaryPeriod>();
  for (const item of summary) {
    monthMap.set(item.period, item);
  }

  return Array.from({ length: 12 }, (_, i): DoctoraliaMonthlyChartDatum => {
    const month = (i + 1).toString().padStart(2, "0");
    const period = `${year}-${month}`;
    const item = monthMap.get(period);

    return {
      month: getDoctoraliaMonthName(i),
      bookings: item?.bookings ?? 0,
      modifications: item?.modifications ?? 0,
      cancellations: item?.cancellations ?? 0,
      total: item?.total ?? 0,
      cancellationRate: item?.cancellationRate ?? 0,
    };
  });
}

export function calculateDoctoraliaYearlyTotals(
  data: DoctoraliaMonthlyChartDatum[]
): DoctoraliaYearlyTotals {
  const bookings = data.reduce((sum, d) => sum + d.bookings, 0);
  const modifications = data.reduce((sum, d) => sum + d.modifications, 0);
  const cancellations = data.reduce((sum, d) => sum + d.cancellations, 0);
  const total = bookings + modifications + cancellations;
  const cancellationRate = bookings > 0 ? cancellations / bookings : 0;
  return { bookings, modifications, cancellations, total, cancellationRate };
}

export function buildDoctoraliaComparisonChartData(
  summary: DoctoraliaEmailMonthlySummaryPeriod[],
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
  summary: DoctoraliaEmailMonthlySummaryPeriod[]
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
