import { createFileRoute } from "@tanstack/react-router";

import { personalFinanceQueries } from "@/features/personal-finance/queries";
import { PersonalCreditsPage } from "@/features/personal-finance/pages/PersonalCreditsPage";

export const Route = createFileRoute("/_authed/finanzas/personal-credits")({
  staticData: {
    nav: { iconKey: "Banknote", label: "Créditos", order: 21, section: "Finanzas" },
    permission: { action: "read", subject: "PersonalCredit" },
    breadcrumb: "Créditos",
  },
  beforeLoad: ({ context }) => {
    // Permission check - Assuming 'PersonalCredit' subject.
    if (!context.can("read", "PersonalCredit")) {
      throw new Error("Unauthorized");
    }
  },
  component: PersonalCreditsPage,

  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(personalFinanceQueries.list());
  },
});
