import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader";

const PayoutsPage = lazy(() =>
  import("@/features/payouts/PayoutsPage").then((m) => ({ default: m.PayoutsPage })),
);

export const Route = createFileRoute("/_authed/finanzas/payouts")({
  staticData: {
    nav: { iconKey: "Wallet", label: "Liquidaciones", order: 20, section: "Finanzas" },
    permission: { action: "read", subject: "ReleaseTransaction" },
  },
  beforeLoad: ({ context }) => {
    // Assuming simple permission check for now using 'read' 'Finance' as a broad category or specific if 'ReleaseTransaction' is mapped in Ability.
    // Ideally this matches the check inside the component or API.
    if (!context.can("read", "ReleaseTransaction")) {
      // Fallback or just let the component handle the error message if we want to be less strict here,
      // but standard is to redirect.
      const routeApi = getRouteApi("/_authed/finanzas/payouts");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <PayoutsPage />
    </Suspense>
  ),

  loader: async ({ context: { queryClient } }) => {
    const { payoutKeys } = await import("@/features/payouts/queries");
    await queryClient.ensureQueryData(payoutKeys.list());
  },
});
