import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const ReleasesPage = lazy(() => import("@/features/finance/mercadopago/pages/ReleaseTransactionsPage"));

export const Route = createFileRoute("/_authed/finanzas/liberaciones")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Integration")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <ReleasesPage />
    </Suspense>
  ),
});
