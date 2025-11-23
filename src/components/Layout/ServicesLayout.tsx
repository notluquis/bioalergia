import { Outlet, Link } from "react-router-dom";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import Button from "@/components/ui/Button";
import { Plus } from "lucide-react";

const SERVICES_TABS: TabItem[] = [
  { label: "Panel", to: "/services", end: true },
  { label: "Agenda", to: "/services/agenda" },
  { label: "Plantillas", to: "/services/templates" },
];

export default function ServicesLayout() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Servicios</h1>
            <p className="text-muted-foreground">Gestión de servicios recurrentes y agenda.</p>
          </div>
          <Link to="/services/create">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Crear Servicio
            </Button>
          </Link>
        </div>
        <Tabs items={SERVICES_TABS} />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
