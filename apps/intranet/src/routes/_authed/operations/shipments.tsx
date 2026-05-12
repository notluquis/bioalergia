import { createFileRoute } from "@tanstack/react-router";
import { ShipmentsPage } from "@/features/shipments/pages/ShipmentsPage";

export const Route = createFileRoute("/_authed/operations/shipments")({
  staticData: {
    nav: { iconKey: "Truck", label: "Despachos", order: 30, section: "Logística" },
    permission: { action: "read", subject: "Shipment" },
    title: "Despachos",
  },
  component: ShipmentsPage,
});
