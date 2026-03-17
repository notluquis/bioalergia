import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { employeeKeys } from "@/features/hr/employees/queries";
import { timesheetQueries } from "@/features/hr/timesheets/queries";
import { TimesheetsPage } from "@/features/hr/timesheets/pages/TimesheetsPage";

export const Route = createFileRoute("/_authed/hr/timesheets")({
  staticData: {
    nav: { iconKey: "Clock", label: "Control Horario", order: 4, section: "Operaciones" },
    permission: { action: "read", subject: "TimesheetList" },
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "TimesheetList")) {
      const routeApi = getRouteApi("/_authed/hr/timesheets");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: TimesheetsPage,

  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(timesheetQueries.months()),
      context.queryClient.ensureQueryData(employeeKeys.list({ includeInactive: false })),
    ]);
  },
});
