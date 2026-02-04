import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

import { employeeKeys } from "@/features/hr/employees/queries";
import { timesheetQueries } from "@/features/hr/timesheets/queries";

const ReportsPage = lazy(() => import("@/features/hr/reports/pages/ReportsPage"));

export const Route = createFileRoute("/_authed/hr/reports")({
  staticData: {
    nav: { iconKey: "FileSpreadsheet", label: "Reportes HR", order: 3, section: "Operaciones" },
    permission: { action: "read", subject: "Report" },
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Report")) {
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
    await Promise.all([
      queryClient.ensureQueryData(employeeKeys.list({ includeInactive: false })),
      queryClient.ensureQueryData(timesheetQueries.months()),
    ]);
  },
});
