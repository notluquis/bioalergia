import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { fetchLoans } from "@/features/finance/loans/api";
import { loanKeys } from "@/features/finance/loans/queries";

const LoansPage = lazy(() => import("@/features/finance/loans/pages/LoansPage"));

export const Route = createFileRoute("/_authed/finanzas/loans")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Loan")) {
      throw redirect({ to: "/" });
    }
  },
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData({
      queryKey: loanKeys.all,
      queryFn: fetchLoans,
    });
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <LoansPage />
    </Suspense>
  ),
});
