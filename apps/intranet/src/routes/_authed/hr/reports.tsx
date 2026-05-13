import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { employeeKeys } from "@/features/hr/employees/queries";
import { timesheetQueries } from "@/features/hr/timesheets/queries";
import { ReportsPage } from "@/features/hr/reports/pages/ReportsPage";

export const Route = createFileRoute("/_authed/hr/reports")({
  staticData: {
    nav: { iconKey: "FileBarChart", label: "Reportes RRHH", order: 50, section: "Personal" },
    permission: { action: "read", subject: "Report" },
    title: "RRHH — Reportes",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Report")) {
      const routeApi = getRouteApi("/_authed/hr/reports");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: ReportsPage,

  loader: async ({ context: { queryClient } }) => {
    await Promise.all([
      queryClient.ensureQueryData(employeeKeys.list({ includeInactive: false })),
      queryClient.ensureQueryData(timesheetQueries.months()),
    ]);
  },
});
