import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const ParticipantInsights = lazy(() => import("@/pages/ParticipantInsights"));

export const Route = createFileRoute("/_authed/finanzas/participants")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Person")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <ParticipantInsights />
    </Suspense>
  ),
});
