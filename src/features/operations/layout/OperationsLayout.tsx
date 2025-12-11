import { Outlet } from "react-router-dom";
import { Tabs, TabItem } from "@/components/ui/Tabs";

const INVENTORY_TABS: TabItem[] = [
  { label: "Items", to: "/operations/inventory" },
  { label: "Solicitud de Insumos", to: "/operations/supplies" },
];

export default function OperationsLayout() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Tabs items={INVENTORY_TABS} />
      <Outlet />
    </div>
  );
}
