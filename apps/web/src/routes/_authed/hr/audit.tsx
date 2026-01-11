import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const TimesheetAuditPage = lazy(() => import("@/features/hr/timesheets-audit/pages/TimesheetAuditPage"));

export const Route = createFileRoute("/_authed/hr/audit")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "TimesheetAudit")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <TimesheetAuditPage />
    </Suspense>
  ),
});
