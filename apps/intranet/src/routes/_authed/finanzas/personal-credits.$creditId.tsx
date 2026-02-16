import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader";
import { personalFinanceQueries } from "@/features/personal-finance/queries";

const PersonalCreditDetailsPage = lazy(() =>
  import("@/features/personal-finance/pages/PersonalCreditDetailsPage").then((m) => ({
    default: m.PersonalCreditDetailsPageWrapper,
  })),
);

export const Route = createFileRoute("/_authed/finanzas/personal-credits/$creditId")({
  beforeLoad: ({ context }) => {
    if (!context.can("read", "PersonalCredit")) {
      throw new Error("Unauthorized");
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <PersonalCreditDetailsPage />
    </Suspense>
  ),

  loader: async ({ context: { queryClient }, params }) => {
    const creditId = Number(params.creditId);
    if (Number.isNaN(creditId)) {
      const routeApi = getRouteApi("/_authed/finanzas/personal-credits/$creditId");
      throw routeApi.redirect({ to: "/finanzas/personal-credits" });
    }
    await queryClient.ensureQueryData(personalFinanceQueries.detail(creditId));
  },
});
