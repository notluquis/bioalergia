import { useStore } from "@tanstack/react-form";

import { StatCard } from "@/components/ui/StatCard";
import { type CalendarUnclassifiedEvent } from "@/features/calendar/types";
import { currencyFormatter } from "@/lib/format";

import { type ClassificationEntry, type FormValues } from "../schemas";

interface ClassificationTotalsProps {
  events: CalendarUnclassifiedEvent[];
  form: any;
}

export function ClassificationTotals({ events, form }: ClassificationTotalsProps) {
  // Subscribe to entries values via TanStack Form's useStore

  const watchedEntries = useStore(form.store, (state: any) => (state as { values: FormValues }).values.entries);

  const totals = watchedEntries?.length
    ? watchedEntries.reduce(
        (acc: { expected: number; paid: number }, entry: ClassificationEntry, index: number) => {
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
      <StatCard title="Esperado" tone="warning" value={currencyFormatter.format(totals.expected)} />
      <StatCard title="Pagado" tone="primary" value={currencyFormatter.format(totals.paid)} />
    </>
  );
}

function parseAmountInput(value: null | string | undefined): null | number {
  if (!value) return null;
  const normalized = value.replaceAll(/\D/g, "");
  if (normalized.length === 0) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}
