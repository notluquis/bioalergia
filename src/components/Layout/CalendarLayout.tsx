import { Outlet } from "react-router-dom";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import { PAGE_CONTAINER } from "@/lib/styles";

const CALENDAR_TABS: TabItem[] = [
  { label: "Resumen", to: "/calendar/summary", end: true },
  { label: "Calendario", to: "/calendar/schedule", end: true },
  { label: "Detalle Diario", to: "/calendar/daily", end: true },
  { label: "Mapa de Calor", to: "/calendar/heatmap", end: true },
  { label: "Clasificar", to: "/calendar/classify", end: true },
  { label: "Historial Sync", to: "/calendar/history", end: true },
];

export default function CalendarLayout() {
  return (
    <div className={PAGE_CONTAINER}>
      <Tabs items={CALENDAR_TABS} />
      <Outlet />
    </div>
  );
}
