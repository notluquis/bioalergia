import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";

import { calendarQueries } from "@/features/calendar/queries";
import { buildCalendarFilters, getScheduleDefaultRange } from "@/features/calendar/utils/filters";
import { CalendarSchedulePage } from "@/pages/CalendarSchedulePage";

import { type CalendarSearchParams, calendarSearchSchema } from "@/features/calendar/types";

export const Route = createFileRoute("/_authed/clinical/agenda")({
  staticData: {
    nav: { iconKey: "CalendarRange", label: "Calendario — agenda", order: 16, section: "Clínica" },
    permission: { action: "read", subject: "CalendarSchedule" },
    title: "Agenda clínica",
  },
  beforeLoad: requirePermission("read", "CalendarSchedule"),
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams => {
    const parsed = calendarSearchSchema.parse(search);
    if (!parsed.from || !parsed.to) {
      const defaults = getScheduleDefaultRange();
      return {
        ...parsed,
        from: parsed.from ?? defaults.from,
        to: parsed.to ?? defaults.to,
      };
    }
    return parsed;
  },
  component: CalendarSchedulePage,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search }) => {
    if (search.source === "doctoralia") {
      return;
    }

    // Mirror the hook's filter derivation (deriveEffectiveFilters) so the
    // prefetched key matches what useCalendarEvents fetches. Settings aren't
    // loader-available; empty-settings defaults match the common case (the
    // dominant prior bug was the date→window divergence, now shared).
    const filters = buildCalendarFilters(search, {});

    await Promise.all([
      context.queryClient.ensureQueryData(calendarQueries.summary(filters)),
      context.queryClient.ensureQueryData(calendarQueries.daily(filters)),
    ]);
  },
});
