import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import PageLoader from "@/components/ui/PageLoader";

const TreatmentAnalyticsPage = lazy(
  () => import("@/features/operations/supplies/pages/TreatmentAnalyticsPage"),
);

export const Route = createFileRoute("/_authed/operations/supplies-analytics")({
  staticData: {
    nav: {
      iconKey: "ChartLine",
      label: "Analytics Tratamientos",
      order: 1,
      section: "Insumos",
    },
    permission: { action: "read", subject: "CalendarEvent" },
    title: "Analytics",
  },
  beforeLoad: ({ context }) => {
    if (!context.auth.can("read", "CalendarEvent")) {
      const routeApi = getRouteApi("/_authed/operations/supplies-analytics");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
  validateSearch: (search: Record<string, unknown>) => {
    return {
      from: search.from as string | undefined,
      to: search.to as string | undefined,
      period: (search.period as "day" | "week" | "month" | undefined) || "week",
    };
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <TreatmentAnalyticsPage />
    </Suspense>
  ),
});
