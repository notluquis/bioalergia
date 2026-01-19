import { DataTable } from "@/components/data-table/DataTable";
import Alert from "@/components/ui/Alert";
import { useAuth } from "@/context/AuthContext";

import { columns } from "./components/columns";
import { usePayouts } from "./hooks/use-payouts";

export default function PayoutsPage() {
  const { can } = useAuth();
  const canView = can("read", "ReleaseTransaction"); // Assuming same permission as logic
  const { payouts } = usePayouts();

  if (!canView) {
    return (
      <div className="p-6">
        <Alert variant="error">No tienes permisos para ver los retiros.</Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base-content text-2xl font-bold">Retiros de Fondos</h1>
          <p className="text-base-content/70 text-sm">Historial de transferencias a cuenta bancaria (Payouts)</p>
        </div>
      </div>

      <DataTable columns={columns} data={payouts} enableVirtualization noDataMessage="No hay retiros registrados." />
    </div>
  );
}
