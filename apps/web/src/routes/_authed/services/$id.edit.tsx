import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const EditServicePage = lazy(() => import("@/features/services/pages/EditServicePage"));

export const Route = createFileRoute("/_authed/services/$id/edit")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("update", "Service")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <EditServicePage />
    </Suspense>
  ),
});
