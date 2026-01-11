import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const EmployeesPage = lazy(() => import("@/features/hr/employees/pages/EmployeesPage"));

export const Route = createFileRoute("/_authed/hr/employees")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Employee")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <EmployeesPage />
    </Suspense>
  ),
});
