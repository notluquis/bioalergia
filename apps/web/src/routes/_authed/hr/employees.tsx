import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { employeeKeys } from "@/features/hr/employees/queries";

const EmployeesPage = lazy(() => import("@/features/hr/employees/pages/EmployeesPage"));

export const Route = createFileRoute("/_authed/hr/employees")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Employee")) {
      const routeApi = getRouteApi("/_authed/hr/employees");
      throw routeApi.redirect({ to: "/" });
    }
  },
  loader: ({ context: { queryClient } }) => {
    return queryClient.ensureQueryData(employeeKeys.list({ includeInactive: false }));
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <EmployeesPage />
    </Suspense>
  ),
});
