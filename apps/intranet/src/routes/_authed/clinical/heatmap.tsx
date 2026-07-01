import { createFileRoute, redirect } from "@tanstack/react-router";

import { type CalendarSearchParams, calendarSearchSchema } from "@/features/calendar/types";
import { addMonths, endOfMonthFor, today } from "@/lib/dates";

// Consolidated into `/calendar?tab=heatmap`. Kept as a redirect for deep-links.
// Preserves the heatmap's default ±1-month window when the link omits from/to
// (the old route filled it in validateSearch).
export const Route = createFileRoute("/_authed/clinical/heatmap")({
  staticData: { hideFromNav: true, title: "Heatmap clínico" },
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams =>
    calendarSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps: search }) => {
    const from = search.from ?? addMonths(today(), -1);
    const to = search.to ?? endOfMonthFor(addMonths(today(), 1));
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: "/calendar", search: { ...search, from, to, tab: "heatmap" } });
  },
  component: () => null,
});
