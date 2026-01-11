import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const TimesheetsPage = lazy(() => import("@/features/hr/timesheets/pages/TimesheetsPage"));

export const Route = createFileRoute("/_authed/hr/timesheets")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "TimesheetList")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <TimesheetsPage />
    </Suspense>
  ),
});
