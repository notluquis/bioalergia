import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { PageLoader } from "@/components/ui/PageLoader";

const Counterparts = lazy(() =>
  import("@/pages/Counterparts").then((m) => ({ default: m.CounterpartsRoute })),
);

export const Route = createFileRoute("/_authed/finanzas/counterparts")({
  staticData: {
    nav: { iconKey: "Users2", label: "Contrapartes", order: 5, section: "Finanzas" },
    permission: { action: "read", subject: "Counterpart" },
    title: "Contrapartes",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Counterpart")) {
      const routeApi = getRouteApi("/_authed/finanzas/counterparts");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  // Note: Skipping loader because this page uses ZenStack useFindManyCounterpart hook
  // which has its own caching mechanism via TanStack Query
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <Counterparts />
    </Suspense>
  ),
});
