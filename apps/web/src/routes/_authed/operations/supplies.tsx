import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const SuppliesPage = lazy(() => import("@/features/operations/supplies/pages/SuppliesPage"));

export const Route = createFileRoute("/_authed/operations/supplies")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "SupplyRequest")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <SuppliesPage />
    </Suspense>
  ),
});
