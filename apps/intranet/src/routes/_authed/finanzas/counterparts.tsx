import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { CounterpartsPage } from "@/features/counterparts/pages/CounterpartsPage";

export const Route = createFileRoute("/_authed/finanzas/counterparts")({
  validateSearch: (search: Record<string, unknown>) =>
    search.tab === "counterparts" || search.tab === "unassigned-payouts" ? { tab: search.tab } : {},
  staticData: {
    nav: { iconKey: "Building2", label: "Contrapartes", order: 70, section: "Finanzas" },
    permission: { action: "read", subject: "Counterpart" },
    title: "Contrapartes",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Counterpart") && !context.can("read", "Person")) {
      const routeApi = getRouteApi("/_authed/finanzas/counterparts");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  // Note: Skipping loader because this page uses ZenStack useFindManyCounterpart hook
  // which has its own caching mechanism via TanStack Query
  component: CounterpartsPage,
});
