import { Outlet } from "react-router-dom";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import { ServicesProvider } from "../hooks/useServicesOverview";
import { PAGE_CONTAINER } from "@/lib/styles";

const SERVICES_TABS: TabItem[] = [
  { label: "Resumen", to: "/services", end: true },
  { label: "Agenda", to: "/services/agenda" },
  { label: "Crear", to: "/services/create" },
];

export default function ServicesLayout() {
  return (
    <ServicesProvider>
      <div className={PAGE_CONTAINER}>
        <Tabs items={SERVICES_TABS} />
        <Outlet />
      </div>
    </ServicesProvider>
  );
}
