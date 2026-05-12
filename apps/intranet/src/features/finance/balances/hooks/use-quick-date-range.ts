import dayjs from "dayjs";

interface QuickDateRangeOptions {
  monthsToShow?: number;
}

export function useQuickDateRange(options?: QuickDateRangeOptions) {
  const monthsToShow = options?.monthsToShow ?? 12;

  const quickMonths = (() => {
    const months: { from: string; label: string; to: string; value: string }[] = [];
    for (let i = 0; i < monthsToShow; i++) {
      const date = dayjs().subtract(i, "month").startOf("month");
      const label = date.format("MMMM YYYY");
      const from = date.format("YYYY-MM-DD");
      const end = date.endOf("month").format("YYYY-MM-DD");
      months.push({ from: from, label, to: end, value: from });
    }
    return months;
  })();

  return { quickMonths };
}
