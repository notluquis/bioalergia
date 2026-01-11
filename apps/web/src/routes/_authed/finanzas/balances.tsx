import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const DailyBalancesPage = lazy(() => import("@/features/finance/balances/pages/DailyBalancesPage"));

export const Route = createFileRoute("/_authed/finanzas/balances")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "DailyBalance")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <DailyBalancesPage />
    </Suspense>
  ),
});
