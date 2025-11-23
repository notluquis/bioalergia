import { Outlet } from "react-router-dom";
import { Tabs, TabItem } from "@/components/ui/Tabs";

const INVENTORY_TABS: TabItem[] = [
  { label: "Items", to: "/inventory/items" },
  { label: "Solicitud de Insumos", to: "/inventory/supplies" },
];

export default function InventoryLayout() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventario</h1>
          <p className="text-muted-foreground">Gestión de stock e insumos.</p>
        </div>
        <Tabs items={INVENTORY_TABS} />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
