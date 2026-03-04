import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const TimesheetAuditPage = lazy(() =>
  import("@/features/hr/timesheets-audit/pages/TimesheetAuditPage").then((m) => ({
    default: m.TimesheetAuditPage,
  })),
);

export const Route = createFileRoute("/_authed/hr/audit")({
  staticData: {
    nav: { iconKey: "History", label: "Auditoría HR", order: 5, section: "Operaciones" },
    permission: { action: "read", subject: "TimesheetAudit" },
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "TimesheetAudit")) {
      const routeApi = getRouteApi("/_authed/hr/audit");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={null}>
      <TimesheetAuditPage />
    </Suspense>
  ),
});
