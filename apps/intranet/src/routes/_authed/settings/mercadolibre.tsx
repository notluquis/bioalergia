import { createFileRoute } from "@tanstack/react-router";

import { MlConnectionPage } from "@/features/catalog/pages/MlConnectionPage";

export const Route = createFileRoute("/_authed/settings/mercadolibre")({
  staticData: {
    nav: { iconKey: "ShoppingBag", label: "MercadoLibre", order: 50, section: "Integraciones" },
    title: "MercadoLibre",
  },
  component: MlConnectionPage,
});
