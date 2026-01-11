import { type Control, useWatch } from "react-hook-form";

import { StatCard } from "@/components/ui/StatCard";
import { type CalendarUnclassifiedEvent } from "@/features/calendar/types";
import { currencyFormatter } from "@/lib/format";

import { type FormValues } from "../schemas";

interface ClassificationTotalsProps {
  control: Control<FormValues>;
  events: CalendarUnclassifiedEvent[];
}

function parseAmountInput(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = value.replaceAll(/\D/g, "");
  if (normalized.length === 0) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function ClassificationTotals({ control, events }: ClassificationTotalsProps) {
  // Only subscribe to entries
  const watchedEntries = useWatch({
    control,
    name: "entries",
  });

  const totals = watchedEntries?.length
    ? watchedEntries.reduce(
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
      )
    : { expected: 0, paid: 0 };

  return (
    <>
      <StatCard title="Esperado" value={currencyFormatter.format(totals.expected)} tone="warning" />
      <StatCard title="Pagado" value={currencyFormatter.format(totals.paid)} tone="primary" />
    </>
  );
}
