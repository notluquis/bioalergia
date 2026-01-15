import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const Counterparts = lazy(() => import("@/pages/Counterparts"));

export const Route = createFileRoute("/_authed/finanzas/counterparts")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Counterpart")) {
      const routeApi = getRouteApi("/_authed/finanzas/counterparts");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <Counterparts />
    </Suspense>
  ),
});
