import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { employeeKeys } from "@/features/hr/employees/queries";
import { EmployeesPage } from "@/features/hr/employees/pages/EmployeesPage";

export const Route = createFileRoute("/_authed/hr/employees")({
  staticData: {
    nav: { iconKey: "UserCheck", label: "Empleados", order: 10, section: "Personal" },
    permission: { action: "read", subject: "Employee" },
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Employee")) {
      const routeApi = getRouteApi("/_authed/hr/employees");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: EmployeesPage,

  loader: ({ context: { queryClient } }) => {
    return queryClient.ensureQueryData(employeeKeys.list({ includeInactive: false }));
  },
});
