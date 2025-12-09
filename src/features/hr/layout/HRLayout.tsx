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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold">Recursos Humanos</h1>
          <p className="text-muted-foreground">Gestión de personal y control de horas.</p>
        </div>
        <Tabs items={HR_TABS} />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
