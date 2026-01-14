import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const OverviewPage = lazy(() => import("@/features/services/pages/OverviewPage"));

// Services index - shows the overview page
export const Route = createFileRoute("/_authed/services/")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "ServiceList")) {
      throw redirect({ to: "/" });
    }
  },
  loader: async ({ context: { queryClient } }) => {
    const { serviceQueries } = await import("@/features/services/queries");
    await queryClient.ensureQueryData(serviceQueries.list(true));
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <OverviewPage />
    </Suspense>
  ),
});
