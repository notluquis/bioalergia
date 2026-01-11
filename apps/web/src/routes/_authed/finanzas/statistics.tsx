import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const FinanzasStatsPage = lazy(() => import("@/features/finance/statistics/pages/FinanzasStatsPage"));

export const Route = createFileRoute("/_authed/finanzas/statistics")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "TransactionStats")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <FinanzasStatsPage />
    </Suspense>
  ),
});
