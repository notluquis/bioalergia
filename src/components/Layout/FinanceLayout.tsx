import { Outlet } from "react-router-dom";
import { Tabs, TabItem } from "@/components/ui/Tabs";

const FINANCE_TABS: TabItem[] = [
  { label: "Movimientos", to: "/finanzas/movements" },
  { label: "Saldos Diarios", to: "/finanzas/balances" },
  { label: "Contrapartes", to: "/finanzas/counterparts" },
  { label: "Participantes", to: "/finanzas/participants" },
  { label: "Préstamos", to: "/finanzas/loans" },
];

export default function FinanceLayout() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finanzas</h1>
          <p className="text-muted-foreground">Gestión de movimientos, saldos y entidades financieras.</p>
        </div>
        <Tabs items={FINANCE_TABS} />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
