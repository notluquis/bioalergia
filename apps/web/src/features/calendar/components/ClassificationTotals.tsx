import { useStore } from "@tanstack/react-form";
import { useMemo } from "react";

import { StatCard } from "@/components/ui/StatCard";
import type { CalendarUnclassifiedEvent } from "@/features/calendar/types";
import { currencyFormatter } from "@/lib/format";

import type { FormValues } from "../schemas";

interface ClassificationTotalsProps {
  events: CalendarUnclassifiedEvent[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any;
}

export function ClassificationTotals({ events, form }: Readonly<ClassificationTotalsProps>) {
  // Subscribe to entries values via TanStack Form's useStore

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
  const watchedEntries = useStore(
    form.store,
    (state: any) => (state as { values: FormValues }).values.entries,
  );

  const totals = useMemo(() => {
    let expected = 0;
    let paid = 0;

    if (watchedEntries.length > 0) {
      for (const [index, entry] of watchedEntries.entries()) {
        // eslint-disable-next-line security/detect-object-injection
        const event = events[index];
        if (event) {
          expected += parseAmountInput(entry.amountExpected) ?? event.amountExpected ?? 0;
          paid += parseAmountInput(entry.amountPaid) ?? event.amountPaid ?? 0;
        }
      }
    }
    return { expected, paid };
  }, [watchedEntries, events]);

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
