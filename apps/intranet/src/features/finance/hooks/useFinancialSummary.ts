import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useMemo } from "react";
import { fetchCalendarDaily } from "@/features/calendar/api";
import type { DateRange, FinancialSummary, IncomeCategoryGroup, IncomeItem } from "../types";

type EventForIncome = {
  amountPaid: null | number;
  category: null | string;
  eventType: null | string;
  externalEventId: string;
  id: number;
  startDate: string;
  summary: null | string;
};

export function useFinancialSummary(dateRange: DateRange) {
  const { data, isLoading } = useQuery({
    queryFn: () =>
      fetchCalendarDaily({
        categories: [],
        from: dateRange.from,
        maxDays: Math.max(dayjs(dateRange.to).diff(dayjs(dateRange.from), "day") + 1, 1),
        to: dateRange.to,
      }),
    queryKey: ["financial-summary", dateRange.from, dateRange.to],
  });
  const events = useMemo(
    () =>
      data?.days
        .flatMap((day) => day.events)
        .filter((event) => (event.amountPaid ?? 0) > 0)
        .map((event) => ({
          amountPaid: event.amountPaid ?? null,
          category: event.category ?? null,
          eventType: event.eventType,
          externalEventId: event.eventId,
          id: Number.parseInt(event.eventId, 10) || 0,
          startDate: event.startDate ?? event.eventDate,
          summary: event.summary,
        })) ?? [],
    [data?.days]
  );

  const summary = useMemo((): FinancialSummary | null => {
    const items: IncomeItem[] = events.map(mapEventToIncomeItem);

    const grouped: Record<string, IncomeItem[]> = {};
    let totalIncome = 0;

    for (const item of items) {
      const bucket = grouped[item.category] ?? [];
      bucket.push(item);
      grouped[item.category] = bucket;
      totalIncome += item.amount;
    }

    const incomesByCategory: IncomeCategoryGroup[] = Object.entries(grouped).map(
      ([cat, catItems]) => ({
        category: cat,
        total: catItems.reduce((sum, i) => sum + i.amount, 0),
        items: catItems,
      })
    );

    // Sort by total desc
    incomesByCategory.sort((a, b) => b.total - a.total);

    return {
      totalIncome,
      totalExpense: 0, // Placeholder
      netIncome: totalIncome, // - 0
      incomesByCategory,
      uncategorizedIncomes: grouped.Otros || [],
    };
  }, [events]);

  return { summary, isLoading };
}

function mapEventToIncomeItem(event: EventForIncome): IncomeItem {
  let category = "Otros";
  const text =
    `${event.summary || ""} ${event.eventType || ""} ${event.category || ""}`.toLowerCase();

  if (text.includes("subcut") || text.includes("inmunoterapia") || text.includes("vacuna")) {
    category = "Tratamientos";
  } else if (
    text.includes("prick") ||
    text.includes("test") ||
    text.includes("espirometr") ||
    text.includes("patch")
  ) {
    category = "Exámenes";
  } else if (text.includes("consulta") || text.includes("control")) {
    category = "Consultas";
  }

  return {
    id: event.externalEventId || String(event.id),
    date: event.startDate ? dayjs(event.startDate, "YYYY-MM-DD").toDate() : dayjs().toDate(),
    summary: event.summary || "Sin título",
    category,
    amount: event.amountPaid || 0,
    originalEvent: {
      amountPaid: event.amountPaid,
      category: event.category,
      eventType: event.eventType,
      externalEventId: event.externalEventId,
      id: event.id,
      startDate: event.startDate ? dayjs(event.startDate, "YYYY-MM-DD").toDate() : null,
      summary: event.summary,
    },
  };
}
