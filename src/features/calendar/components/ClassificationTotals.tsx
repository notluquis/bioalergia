import React, { useMemo } from "react";
import { type Control, useWatch } from "react-hook-form";
import { type FormValues } from "../schemas";
import { type CalendarUnclassifiedEvent } from "@/features/calendar/types";
import { currencyFormatter } from "@/lib/format";

import { StatCard } from "@/components/ui/StatCard";

interface ClassificationTotalsProps {
  control: Control<FormValues>;
  events: CalendarUnclassifiedEvent[];
}

function parseAmountInput(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.replace(/[^0-9]/g, "");
  if (!normalized.length) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export const ClassificationTotals = React.memo(function ClassificationTotals({
  control,
  events,
}: ClassificationTotalsProps) {
  // Only subscribe to entries
  const watchedEntries = useWatch({
    control,
    name: "entries",
  });

  const totals = useMemo(() => {
    if (!watchedEntries || !watchedEntries.length) return { expected: 0, paid: 0 };
    return watchedEntries.reduce(
      (acc, entry, index) => {
        const event = events[index];
        if (!event) return acc;
        const expected = parseAmountInput(entry?.amountExpected) ?? event.amountExpected ?? 0;
        const paid = parseAmountInput(entry?.amountPaid) ?? event.amountPaid ?? 0;
        return {
          expected: acc.expected + expected,
          paid: acc.paid + paid,
        };
      },
      { expected: 0, paid: 0 }
    );
  }, [watchedEntries, events]);

  return (
    <>
      <StatCard title="Esperado" value={currencyFormatter.format(totals.expected)} tone="warning" />
      <StatCard title="Pagado" value={currencyFormatter.format(totals.paid)} tone="primary" />
    </>
  );
});
