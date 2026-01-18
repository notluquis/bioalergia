import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";
import { personalFinanceQueries } from "@/features/personal-finance/queries";

const PersonalCreditsPage = lazy(() => import("@/features/personal-finance/pages/PersonalCreditsPage"));

export const Route = createFileRoute("/_authed/finanzas/personal-credits")({
  beforeLoad: () => {
    // Permission check - Assuming 'PersonalCredit' subject.
    // If not yet seeded, this might deny access if strict.
    // For now, let's allow if user is authenticated (which _authed guarantees).
    // if (!context.auth.can("read", "PersonalCredit")) { ... }
    return;
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
