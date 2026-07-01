import { createFileRoute, redirect } from "@tanstack/react-router";

import { type CalendarSearchParams, calendarSearchSchema } from "@/features/calendar/types";

// Consolidated into `/calendar?tab=dia`. Kept as a redirect for deep-links.
export const Route = createFileRoute("/_authed/clinical/day")({
  staticData: { hideFromNav: true, title: "Detalle diario clínico" },
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams =>
    calendarSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps: search }) => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: "/calendar", search: { ...search, tab: "dia" } });
  },
  component: () => null,
});
