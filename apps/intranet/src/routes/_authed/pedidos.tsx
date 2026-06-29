import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { OrdersPage } from "@/features/shop/orders-admin/pages/OrdersPage";

export const Route = createFileRoute("/_authed/pedidos")({
  staticData: {
    nav: { iconKey: "Receipt", label: "Pedidos", order: 45, section: "Logística" },
    permission: { action: "read", subject: "ShopOrder" },
    title: "Pedidos",
  },
  beforeLoad: requirePermission("read", "ShopOrder"),
  component: OrdersPage,
});
