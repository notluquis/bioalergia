import { createFileRoute, redirect } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const Counterparts = lazy(() => import("@/pages/Counterparts"));

export const Route = createFileRoute("/_authed/finanzas/counterparts")({
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "Counterpart")) {
      throw redirect({ to: "/" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <Counterparts />
    </Suspense>
  ),
});
