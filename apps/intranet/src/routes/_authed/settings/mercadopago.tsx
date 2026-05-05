import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { MercadoPagoSettingsPage } from "@/pages/settings/MercadoPagoSettingsPage";

export const Route = createFileRoute("/_authed/settings/mercadopago")({
  staticData: {
    nav: { iconKey: "CreditCard", label: "MercadoPago", order: 60, section: "Sistema" },
    permission: { action: "read", subject: "Integration" },
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "Integration")) {
      const routeApi = getRouteApi("/_authed/settings/mercadopago");
      throw routeApi.redirect({ to: "/" });
    }
  },
  component: MercadoPagoSettingsPage,
});
