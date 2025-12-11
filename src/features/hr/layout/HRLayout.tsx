import { Outlet } from "react-router-dom";
import { Tabs, TabItem } from "@/components/ui/Tabs";

const HR_TABS: TabItem[] = [
  { label: "Trabajadores", to: "/hr/employees" },
  { label: "Horas y Pagos", to: "/hr/timesheets" },
  { label: "Auditoría", to: "/hr/audit" },
  { label: "Reportería", to: "/hr/reports" },
];

export default function HRLayout() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Tabs items={HR_TABS} />
      <Outlet />
    </div>
  );
}
