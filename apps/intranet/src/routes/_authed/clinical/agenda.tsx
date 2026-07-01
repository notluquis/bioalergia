import { createFileRoute, redirect } from "@tanstack/react-router";

import { type CalendarSearchParams, calendarSearchSchema } from "@/features/calendar/types";

// Consolidated into `/calendar?tab=vista`. Kept as a redirect so existing
// deep-links (bookmarks, emailed ranges) keep resolving.
export const Route = createFileRoute("/_authed/clinical/agenda")({
  staticData: { hideFromNav: true, title: "Agenda clínica" },
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams =>
    calendarSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps: search }) => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw redirect({ to: "/calendar", search: { ...search, tab: "vista" } });
  },
  component: () => null,
});
