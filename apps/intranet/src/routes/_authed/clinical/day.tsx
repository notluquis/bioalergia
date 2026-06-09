import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";

import { calendarQueries } from "@/features/calendar/queries";
import { buildCalendarFilters } from "@/features/calendar/utils/filters";
import { CalendarDailyPage } from "@/pages/CalendarDailyPage";

import { type CalendarSearchParams, calendarSearchSchema } from "@/features/calendar/types";

export const Route = createFileRoute("/_authed/clinical/day")({
  staticData: {
    nav: { iconKey: "CalendarCheck", label: "Calendario — día", order: 17, section: "Clínica" },
    permission: { action: "read", subject: "CalendarDaily" },
    title: "Detalle diario clínico",
  },
  beforeLoad: requirePermission("read", "CalendarDaily"),
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams =>
    calendarSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  component: CalendarDailyPage,
  loader: async ({ context, deps: search }) => {
    // Mirror the hook's filter derivation so the prefetched key matches what
    // useCalendarEvents fetches (a divergent key wasted the prefetch). The
    // date→window expansion now lives in the shared buildCalendarFilters.
    const filters = buildCalendarFilters(search, {});

    await Promise.all([
      context.queryClient.ensureQueryData(calendarQueries.summary(filters)),
      context.queryClient.ensureQueryData(calendarQueries.daily(filters)),
    ]);
  },
});
