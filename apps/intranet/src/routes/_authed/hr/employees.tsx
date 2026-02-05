import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader";
import { employeeKeys } from "@/features/hr/employees/queries";

const EmployeesPage = lazy(() =>
  import("@/features/hr/employees/pages/EmployeesPage").then((m) => ({ default: m.EmployeesPage })),
);

export const Route = createFileRoute("/_authed/hr/employees")({
  staticData: {
    nav: { iconKey: "Users2", label: "Empleados", order: 2, section: "Operaciones" },
    permission: { action: "read", subject: "Employee" },
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Employee")) {
      const routeApi = getRouteApi("/_authed/hr/employees");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <EmployeesPage />
    </Suspense>
  ),

  loader: ({ context: { queryClient } }) => {
    return queryClient.ensureQueryData(employeeKeys.list({ includeInactive: false }));
  },
});
