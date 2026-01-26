import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { calendarQueries } from "@/features/calendar/queries";
import { computeDefaultFilters } from "@/features/calendar/utils/filters";

const CalendarDailyPage = lazy(() => import("@/pages/CalendarDailyPage"));

const routeApi = getRouteApi("/_authed/calendar/daily");

export const Route = createFileRoute("/_authed/calendar/daily")({
  staticData: {
    nav: { iconKey: "Calendar", label: "Detalle Diario", order: 2, section: "Calendario" },
    permission: { action: "read", subject: "CalendarDaily" },
    title: "Detalle diario",
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "CalendarDaily")) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CalendarDailyPage />
    </Suspense>
  ),
  loader: async ({ context }) => {
    const defaults = computeDefaultFilters({});
    await Promise.all([
      context.queryClient.ensureQueryData(calendarQueries.summary(defaults)),
      context.queryClient.ensureQueryData(calendarQueries.daily(defaults)),
    ]);
  },
});
