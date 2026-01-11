import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const InventoryPage = lazy(() => import("@/features/operations/inventory/pages/InventoryPage"));

export const Route = createFileRoute("/_authed/operations/inventory")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "InventoryItem")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <InventoryPage />
    </Suspense>
  ),
});
