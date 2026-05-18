import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { ChannelPricesPage } from "@/pages/operations/ChannelPricesPage";

export const Route = createFileRoute("/_authed/operations/channel-prices")({
  staticData: {
    nav: { iconKey: "DollarSign", label: "Precios canal", order: 16, section: "Logística" },
    permission: { action: "update", subject: "Product" },
    title: "Precios por canal",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("update", "Product")) {
      const routeApi = getRouteApi("/_authed/operations/channel-prices");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: ChannelPricesPage,
});
