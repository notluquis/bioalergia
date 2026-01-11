import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const ReportsPage = lazy(() => import("@/features/hr/reports/pages/ReportsPage"));

export const Route = createFileRoute("/_authed/hr/reports")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Report")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <ReportsPage />
    </Suspense>
  ),
});
