import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { calendarQueries } from "@/features/calendar/queries";

const CalendarClassificationPage = lazy(() => import("@/pages/CalendarClassificationPage"));

const routeApi = getRouteApi("/_authed/calendar/classify");

export const Route = createFileRoute("/_authed/calendar/classify")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("update", "CalendarEvent")) {
      throw routeApi.redirect({ to: "/" });
    }
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(calendarQueries.unclassified(0, 50, {})),
      context.queryClient.ensureQueryData(calendarQueries.options()),
    ]);
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CalendarClassificationPage />
    </Suspense>
  ),
});
