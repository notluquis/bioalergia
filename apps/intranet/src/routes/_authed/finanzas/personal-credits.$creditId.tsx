import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader";
import { personalFinanceQueries } from "@/features/personal-finance/queries";

const PersonalCreditDetailsPage = lazy(() =>
  import("@/features/personal-finance/pages/PersonalCreditDetailsPage").then((m) => ({
    default: m.PersonalCreditDetailsPageWrapper,
  })),
);

export const Route = createFileRoute("/_authed/finanzas/personal-credits/$creditId")({
  beforeLoad: () => {
    // Permission check
    return;
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <PersonalCreditDetailsPage />
    </Suspense>
  ),

  loader: async ({ context: { queryClient }, params }) => {
    const creditId = Number(params.creditId);
    if (!Number.isNaN(creditId)) {
      await queryClient.ensureQueryData(personalFinanceQueries.detail(creditId));
    }
  },
});
