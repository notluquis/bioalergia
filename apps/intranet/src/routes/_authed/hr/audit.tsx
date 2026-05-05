import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { TimesheetAuditPage } from "@/features/hr/timesheets-audit/pages/TimesheetAuditPage";

export const Route = createFileRoute("/_authed/hr/audit")({
  staticData: {
    nav: { iconKey: "History", label: "Auditoría RRHH", order: 60, section: "Personal" },
    permission: { action: "read", subject: "TimesheetAudit" },
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "TimesheetAudit")) {
      const routeApi = getRouteApi("/_authed/hr/audit");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: TimesheetAuditPage,
});
