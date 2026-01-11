import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const CalendarClassificationPage = lazy(() => import("@/pages/CalendarClassificationPage"));

export const Route = createFileRoute("/_authed/calendar/classify")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("update", "CalendarEvent")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <CalendarClassificationPage />
    </Suspense>
  ),
});
