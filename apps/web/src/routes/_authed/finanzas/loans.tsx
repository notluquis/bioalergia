import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const LoansPage = lazy(() => import("@/features/finance/loans/pages/LoansPage"));

export const Route = createFileRoute("/_authed/finanzas/loans")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Loan")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <LoansPage />
    </Suspense>
  ),
});
