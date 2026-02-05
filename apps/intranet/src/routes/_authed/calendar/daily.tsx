import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader";
import { calendarQueries } from "@/features/calendar/queries";
import { computeDefaultFilters } from "@/features/calendar/utils/filters";

const CalendarDailyPage = lazy(() =>
  import("@/pages/CalendarDailyPage").then((m) => ({ default: m.CalendarDailyPage })),
);

import {
  type CalendarFilters,
  type CalendarSearchParams,
  calendarSearchSchema,
} from "@/features/calendar/types";

const routeApi = getRouteApi("/_authed/calendar/daily");

export const Route = createFileRoute("/_authed/calendar/daily")({
  staticData: {
    nav: { iconKey: "Calendar", label: "Detalle Diario", order: 2, section: "Calendario" },
    permission: { action: "read", subject: "CalendarDaily" },
    title: "Detalle diario",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "CalendarDaily")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams =>
    calendarSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CalendarDailyPage />
    </Suspense>
  ),

  loader: async ({ context, deps: search }) => {
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
