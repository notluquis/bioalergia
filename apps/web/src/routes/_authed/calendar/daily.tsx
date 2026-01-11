import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const CalendarDailyPage = lazy(() => import("@/pages/CalendarDailyPage"));

export const Route = createFileRoute("/_authed/calendar/daily")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "CalendarDaily")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CalendarDailyPage />
    </Suspense>
  ),
});
