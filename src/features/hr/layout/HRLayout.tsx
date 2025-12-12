import { Outlet } from "react-router-dom";
import { Tabs, TabItem } from "@/components/ui/Tabs";
import { PAGE_CONTAINER } from "@/lib/styles";

const HR_TABS: TabItem[] = [
  { label: "Trabajadores", to: "/hr/employees", end: true },
  { label: "Horas y Pagos", to: "/hr/timesheets", end: true },
  { label: "Auditoría", to: "/hr/audit", end: true },
  { label: "Reportería", to: "/hr/reports", end: true },
];

export default function HRLayout() {
  return (
    <div className={PAGE_CONTAINER}>
      <Tabs items={HR_TABS} />
      <Outlet />
    </div>
  );
}
