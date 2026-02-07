import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { lazy } from "react";

const DTEAnalyticsPage = lazy(() =>
  import("@/pages/finanzas/DTEAnalyticsPage").then((m) => ({ default: m.DTEAnalyticsPage })),
);

export const Route = createFileRoute("/_authed/finanzas/dte-analytics")({
  component: DTEAnalyticsPage,
  staticData: {
    nav: {
      iconKey: "BarChart3",
      label: "Análisis DTEs",
      order: 10,
      section: "Finanzas",
    },
    permission: { action: "read", subject: "DTEPurchaseDetail" },
    title: "Análisis de DTEs",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "DTEPurchaseDetail")) {
      const routeApi = getRouteApi("/_authed/finanzas/dte-analytics");
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw routeApi.redirect({ to: "/" });
    }
  },
});
