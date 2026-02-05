import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader";
import { fetchLoans } from "@/features/finance/loans/api";
import { loanKeys } from "@/features/finance/loans/queries";

const LoansPage = lazy(() =>
  import("@/features/finance/loans/pages/LoansPage").then((m) => ({ default: m.LoansPage })),
);

export const Route = createFileRoute("/_authed/finanzas/loans")({
  staticData: {
    nav: { iconKey: "PiggyBank", label: "Préstamos", order: 8, section: "Finanzas" },
    permission: { action: "read", subject: "Loan" },
    title: "Gestión de préstamos",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Loan")) {
      const routeApi = getRouteApi("/_authed/finanzas/loans");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
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
