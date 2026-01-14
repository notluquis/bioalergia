import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const PayoutsPage = lazy(() => import("@/features/payouts/PayoutsPage"));

export const Route = createFileRoute("/_authed/finanzas/payouts")({
  beforeLoad: ({ context }) => {
    // Assuming simple permission check for now using 'read' 'Finance' as a broad category or specific if 'ReleaseTransaction' is mapped in Ability.
    // Ideally this matches the check inside the component or API.
    if (!context.auth.can("read", "ReleaseTransaction")) {
      // Fallback or just let the component handle the error message if we want to be less strict here,
      // but standard is to redirect.
      throw redirect({ to: "/" });
    }
  },
  loader: async ({ context: { queryClient } }) => {
    const { payoutKeys } = await import("@/features/payouts/queries");
    await queryClient.ensureQueryData(payoutKeys.list());
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <PayoutsPage />
    </Suspense>
  ),
});
