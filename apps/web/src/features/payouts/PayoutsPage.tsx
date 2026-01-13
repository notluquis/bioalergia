import { Download } from "lucide-react";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

import { PayoutsTable } from "./components/PayoutsTable";
import { usePayouts } from "./hooks/usePayouts";

export default function PayoutsPage() {
  const { can } = useAuth();
  const canView = can("read", "ReleaseTransaction"); // Assuming same permission as logic
  const { payouts, isLoading, isError } = usePayouts();

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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => globalThis.print()}>
            <Download className="mr-2 h-4 w-4" />
            Exportar / Imprimir
          </Button>
        </div>
      </div>

      {isError ? (
        <Alert variant="error">Ocurrió un error al cargar los retiros. Por favor, intenta nuevamente.</Alert>
      ) : (
        <PayoutsTable payouts={payouts} isLoading={isLoading} />
      )}
    </div>
  );
}
