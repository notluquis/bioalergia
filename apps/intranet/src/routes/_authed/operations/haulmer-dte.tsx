import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { HaulmerDtePage } from "@/pages/operations/HaulmerDtePage";

export const Route = createFileRoute("/_authed/operations/haulmer-dte")({
  staticData: {
    nav: { iconKey: "FileText", label: "Haulmer DTE", order: 20, section: "Logística" },
    permission: { action: "read", subject: "Haulmer" },
    title: "Haulmer DTE",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Haulmer")) {
      const routeApi = getRouteApi("/_authed/operations/haulmer-dte");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: HaulmerDtePage,
});
