import { Outlet } from "react-router-dom";
import { Tabs, TabItem } from "@/components/ui/Tabs";

const CALENDAR_TABS: TabItem[] = [
  { label: "Resumen", to: "/calendar/summary" },
  { label: "Calendario", to: "/calendar/schedule" },
  { label: "Detalle Diario", to: "/calendar/daily" },
  { label: "Mapa de Calor", to: "/calendar/heatmap" },
  { label: "Clasificar", to: "/calendar/classify" },
  { label: "Historial Sync", to: "/calendar/history" },
];

export default function CalendarLayout() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendario</h1>
          <p className="text-muted-foreground">Visualización y gestión de eventos y sincronizaciones.</p>
        </div>
        <Tabs items={CALENDAR_TABS} />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
