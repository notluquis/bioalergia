import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { employeeKeys } from "@/features/hr/employees/queries";
import { timesheetQueries } from "@/features/hr/timesheets/queries";

const TimesheetsPage = lazy(() => import("@/features/hr/timesheets/pages/TimesheetsPage"));

export const Route = createFileRoute("/_authed/hr/timesheets")({
  staticData: {
    nav: { iconKey: "Clock", label: "Control Horario", order: 4, section: "Operaciones" },
    permission: { action: "read", subject: "TimesheetList" },
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "TimesheetList")) {
      const routeApi = getRouteApi("/_authed/hr/timesheets");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <TimesheetsPage />
    </Suspense>
  ),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(timesheetQueries.months()),
      context.queryClient.ensureQueryData(employeeKeys.list({ includeInactive: false })),
    ]);
  },
});
