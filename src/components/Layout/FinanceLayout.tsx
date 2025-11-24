import { Outlet } from "react-router-dom";

export default function FinanceLayout() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finanzas</h1>
          <p className="text-muted-foreground">Gestión de movimientos, saldos y entidades financieras.</p>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
