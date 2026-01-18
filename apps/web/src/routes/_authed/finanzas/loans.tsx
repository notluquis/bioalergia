import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { fetchLoans } from "@/features/finance/loans/api";
import { loanKeys } from "@/features/finance/loans/queries";

const LoansPage = lazy(() => import("@/features/finance/loans/pages/LoansPage"));

export const Route = createFileRoute("/_authed/finanzas/loans")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Loan")) {
      const routeApi = getRouteApi("/_authed/finanzas/loans");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <LoansPage />
    </Suspense>
  ),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData({
      queryFn: fetchLoans,
      queryKey: loanKeys.all,
    });
  },
});
