import React, { useMemo } from "react";
import { type Control, useWatch } from "react-hook-form";
import { type FormValues } from "../schemas";
import { type CalendarUnclassifiedEvent } from "@/features/calendar/types";
import { currencyFormatter } from "@/lib/format";

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
      <div className="from-warning/10 to-warning/5 ring-warning/20 rounded-2xl bg-linear-to-br p-5 ring-1">
        <div className="text-warning/70 text-xs font-medium tracking-wide uppercase">Esperado</div>
        <div className="text-warning mt-1 text-2xl font-bold tabular-nums">
          {currencyFormatter.format(totals.expected)}
        </div>
      </div>
      <div className="from-info/10 to-info/5 ring-info/20 rounded-2xl bg-linear-to-br p-5 ring-1">
        <div className="text-info/70 text-xs font-medium tracking-wide uppercase">Pagado</div>
        <div className="text-info mt-1 text-2xl font-bold tabular-nums">{currencyFormatter.format(totals.paid)}</div>
      </div>
    </>
  );
});
