import { createFileRoute, redirect } from "@tanstack/react-router";

import { type CalendarSearchParams, calendarSearchSchema } from "@/features/calendar/types";

// Consolidated into `/calendar?tab=heatmap`. Kept as a redirect for deep-links.
export const Route = createFileRoute("/_authed/clinical/heatmap")({
  staticData: { hideFromNav: true, title: "Heatmap clínico" },
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams =>
    calendarSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps: search }) => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: "/calendar", search: { ...search, tab: "heatmap" } });
  },
  component: () => null,
});
