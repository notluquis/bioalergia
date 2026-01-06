import dayjs from "dayjs";

interface QuickDateRangeOptions {
  monthsToShow?: number;
}

export function useQuickDateRange(options?: QuickDateRangeOptions) {
  const monthsToShow = options?.monthsToShow ?? 12;

  const quickMonths = (() => {
    const months: Array<{ value: string; label: string; from: string; to: string }> = [];
    for (let i = 0; i < monthsToShow; i++) {
      const date = dayjs().subtract(i, "month").startOf("month");
      const label = date.format("MMMM YYYY");
      const from = date.format("YYYY-MM-DD");
      const end = date.endOf("month").format("YYYY-MM-DD");
      months.push({ value: from, label, from: from, to: end });
    }
    return months;
  })();

  return { quickMonths };
}
