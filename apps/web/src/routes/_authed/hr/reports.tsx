import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const ReportsPage = lazy(() => import("@/features/hr/reports/pages/ReportsPage"));

export const Route = createFileRoute("/_authed/hr/reports")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Report")) {
      const routeApi = getRouteApi("/_authed/hr/reports");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <ReportsPage />
    </Suspense>
  ),
  loader: async ({ context: { queryClient } }) => {
    const { employeeKeys } = await import("@/features/hr/employees/queries");
    const { timesheetQueries } = await import("@/features/hr/timesheets/queries");

    await Promise.all([
      queryClient.ensureQueryData(employeeKeys.list({ includeInactive: false })),
      queryClient.ensureQueryData(timesheetQueries.months()),
    ]);
  },
});
