import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { personalFinanceQueries } from "@/features/personal-finance/queries";
import { PersonalCreditDetailsPageWrapper } from "@/features/personal-finance/pages/PersonalCreditDetailsPage";

export const Route = createFileRoute("/_authed/finanzas/personal/$creditId")({
  staticData: {
    breadcrumb: (data: unknown) => {
      const credit = data as
        | { bankName?: string; description?: string; creditNumber?: string }
        | undefined;
      return (
        `${credit?.bankName} ${credit?.description || credit?.creditNumber || "Detalle"}`.trim() ||
        "Detalle"
      );
    },
    title: "Finanzas — Detalle de crédito",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "PersonalCredit")) {
      throw new Error("Unauthorized");
    }
  },
  component: PersonalCreditDetailsPageWrapper,

  loader: async ({ context: { queryClient }, params }) => {
    const creditId = Number(params.creditId);
    if (Number.isNaN(creditId)) {
      const routeApi = getRouteApi("/_authed/finanzas/personal/$creditId");
      throw routeApi.redirect({ to: "/finanzas/personal", search: { tab: "creditos" } });
    }
    await queryClient.ensureQueryData(personalFinanceQueries.detail(creditId));
  },
});
