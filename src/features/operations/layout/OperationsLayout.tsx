import { Outlet } from "react-router-dom";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import { PAGE_CONTAINER } from "@/lib/styles";

const INVENTORY_TABS: TabItem[] = [
  { label: "Items", to: "/operations/inventory", end: true },
  { label: "Solicitud de Insumos", to: "/operations/supplies", end: true },
];

export default function OperationsLayout() {
  return (
    <div className={PAGE_CONTAINER}>
      <Tabs items={INVENTORY_TABS} />
      <Outlet />
    </div>
  );
}
