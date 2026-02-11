import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader";
import { calendarQueries } from "@/features/calendar/queries";
import { computeDefaultFilters, getScheduleDefaultRange } from "@/features/calendar/utils/filters";

const CalendarSchedulePage = lazy(() =>
  import("@/pages/CalendarSchedulePage").then((m) => ({ default: m.CalendarSchedulePage })),
);

import {
  type CalendarFilters,
  type CalendarSearchParams,
  calendarSearchSchema,
} from "@/features/calendar/types";

const routeApi = getRouteApi("/_authed/calendar/schedule");

export const Route = createFileRoute("/_authed/calendar/schedule")({
  staticData: {
    nav: { iconKey: "CalendarDays", label: "Calendario", order: 1, section: "Calendario" },
    permission: { action: "read", subject: "CalendarSchedule" },
    title: "Calendario interactivo",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "CalendarSchedule")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
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
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CalendarSchedulePage />
    </Suspense>
  ),

  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search }) => {
    if (search.source === "doctoralia") {
      return;
    }

    const defaults = computeDefaultFilters({});
    const filters: CalendarFilters = {
      calendarIds: search.calendarId ?? [],
      categories: search.category ?? [],
      from: search.from ?? (search.date ? search.date : defaults.from),
      maxDays: search.maxDays ?? defaults.maxDays,
      search: search.search ?? "",
      to: search.to ?? (search.date ? search.date : defaults.to),
    };

    await Promise.all([
      context.queryClient.ensureQueryData(calendarQueries.summary(filters)),
      context.queryClient.ensureQueryData(calendarQueries.daily(filters)),
    ]);
  },
});
