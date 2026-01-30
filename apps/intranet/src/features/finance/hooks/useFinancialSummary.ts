import type { Event } from "@finanzas/db";
import { schemaLite, useClientQueries } from "@finanzas/db";

import { useMemo } from "react";
import type { DateRange, FinancialSummary, IncomeCategoryGroup, IncomeItem } from "../types";

type EventForIncome = Pick<
  Event,
  "id" | "externalEventId" | "startDate" | "summary" | "eventType" | "category" | "amountPaid"
>;

export function useFinancialSummary(dateRange: DateRange) {
  const client = useClientQueries(schemaLite);

  const { data: events, isLoading } = client.event.useFindMany({
    where: {
      AND: [
        { startDate: { gte: new Date(dateRange.from) } },
        { startDate: { lte: new Date(dateRange.to) } },
        { amountPaid: { gt: 0 } },
      ],
    },
    orderBy: { startDate: "desc" },
  });

  const summary = useMemo((): FinancialSummary | null => {
    if (!events) return null;

    const items: IncomeItem[] = events.map(mapEventToIncomeItem);

    const grouped: Record<string, IncomeItem[]> = {};
    let totalIncome = 0;

    for (const item of items) {
      (grouped[item.category] ??= []).push(item);
      totalIncome += item.amount;
    }

    const incomesByCategory: IncomeCategoryGroup[] = Object.entries(grouped).map(
      ([cat, catItems]) => ({
        category: cat,
        total: catItems.reduce((sum, i) => sum + i.amount, 0),
        items: catItems,
      }),
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
    date: event.startDate ? new Date(event.startDate) : new Date(),
    summary: event.summary || "Sin título",
    category,
    amount: event.amountPaid || 0,
    originalEvent: event,
  };
}
