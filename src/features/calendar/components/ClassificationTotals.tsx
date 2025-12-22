import React, { useMemo } from "react";
import { type Control, useWatch } from "react-hook-form";
import { type FormValues } from "../schemas";
import { type CalendarUnclassifiedEvent } from "@/features/calendar/types";
import { currencyFormatter } from "@/lib/format";

interface ClassificationTotalsProps {
  control: Control<FormValues>;
  events: CalendarUnclassifiedEvent[];
  pendingCount: number;
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
  pendingCount,
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
    <div className="border-base-300 bg-base-100 grid gap-4 rounded-2xl border p-4 text-xs shadow-sm sm:grid-cols-3">
      <div>
        <p className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">Pendientes</p>
        <p className="text-primary mt-1 text-xl font-semibold">{pendingCount}</p>
      </div>
      <div>
        <p className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">Monto esperado sugerido</p>
        <p className="text-primary mt-1 text-xl font-semibold">{currencyFormatter.format(totals.expected)}</p>
      </div>
      <div>
        <p className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">Monto pagado sugerido</p>
        <p className="text-primary mt-1 text-xl font-semibold">{currencyFormatter.format(totals.paid)}</p>
      </div>
    </div>
  );
});
