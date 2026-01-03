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

import { StatCard } from "@/components/ui/StatCard";

// ... (keep imports but added StatCard above, actually better to just replace imports if I can or add at top)

export const ClassificationTotals = React.memo(function ClassificationTotals({
  control,
  events,
}: ClassificationTotalsProps) {
  // ... (keep hooks)
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
      <StatCard
        title="Pagado"
        value={currencyFormatter.format(totals.paid)}
        tone="primary" // Changed to primary/info matches blue? Original was info. Let's use info if StatCard supports it, or generic blue.
        // wait, StatCard supports: default, primary, success, error, warning.
        // The original used "info" (blue in daisyUI). "primary" is likely close enough or I can add "info" to StatCard.
        // I will stick to "primary" for now or check StatCard types again.
      />
    </>
  );
});
