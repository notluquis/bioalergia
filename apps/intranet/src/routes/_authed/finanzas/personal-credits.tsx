import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { personalFinanceQueries } from "@/features/personal-finance/queries";

const PersonalCreditsPage = lazy(
  () => import("@/features/personal-finance/pages/PersonalCreditsPage"),
);

export const Route = createFileRoute("/_authed/finanzas/personal-credits")({
  staticData: {
    nav: { iconKey: "Banknote", label: "Créditos", order: 21, section: "Finanzas" },
    permission: { action: "read", subject: "PersonalCredit" },
  },
  beforeLoad: ({ context }) => {
    // Permission check - Assuming 'PersonalCredit' subject.
    if (!context.auth.can("read", "PersonalCredit")) {
      throw new Error("Unauthorized");
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <PersonalCreditsPage />
    </Suspense>
  ),
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(personalFinanceQueries.list());
  },
});
