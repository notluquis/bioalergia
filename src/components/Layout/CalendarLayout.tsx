import { Outlet } from "react-router-dom";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import { PAGE_CONTAINER } from "@/lib/styles";

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
    <div className={PAGE_CONTAINER}>
      <Tabs items={CALENDAR_TABS} />
      <Outlet />
    </div>
  );
}
