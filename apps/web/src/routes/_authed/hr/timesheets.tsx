import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { employeeKeys } from "@/features/hr/employees/queries";
import { timesheetQueries } from "@/features/hr/timesheets/queries";

const TimesheetsPage = lazy(() => import("@/features/hr/timesheets/pages/TimesheetsPage"));

export const Route = createFileRoute("/_authed/hr/timesheets")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "TimesheetList")) {
      throw redirect({ to: "/" });
    }
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(timesheetQueries.months()),
      context.queryClient.ensureQueryData(employeeKeys.list({ includeInactive: false })),
    ]);
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <TimesheetsPage />
    </Suspense>
  ),
});
