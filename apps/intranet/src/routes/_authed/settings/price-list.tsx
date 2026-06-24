import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { PriceListPage } from "@/features/settings/pages/PriceListPage";

export const Route = createFileRoute("/_authed/settings/price-list")({
  staticData: {
    nav: { iconKey: "Coins", label: "Lista de precios", order: 50, section: "Finanzas" },
    permission: { action: "read", subject: "Setting" },
    title: "Configuración — Lista de precios",
  },
  beforeLoad: requirePermission("read", "Setting"),
  component: PriceListPage,
});
