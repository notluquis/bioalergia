import { Surface } from "@heroui/react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { SupplyRequestForm } from "@/features/supplies/components/SupplyRequestForm";
import { SupplyRequestsTable } from "@/features/supplies/components/SupplyRequestsTable";
import { useSupplyManagement } from "@/features/supplies/hooks/use-supply-management";
export function Supplies() {
  const { can } = useAuth();
  const { commonSupplies, handleStatusChange, refresh, requests } = useSupplyManagement();

  const canCreate = can("create", "SupplyRequest");
  const canUpdate = can("update", "SupplyRequest");
  const isAdmin = canUpdate;
  const tableTitle = isAdmin ? "Todas las solicitudes" : "Solicitudes activas";

  return (
    <section className="space-y-8">
      {canCreate && (
        <Surface className="rounded-[28px] p-6 shadow-inner space-y-6">
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-foreground text-lg">Solicitar nuevo insumo</h2>
              <p className="text-default-500 text-xs">
                Selecciona el insumo y añade observaciones para el equipo de compras.
              </p>
            </div>
            <SupplyRequestForm commonSupplies={commonSupplies} onSuccess={refresh} />
          </div>
        </Surface>
      )}

      <Surface className="rounded-[28px] p-6 shadow-inner space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-default-500 text-sm">{tableTitle}</p>
          <Button
            className="w-full sm:w-auto"
            onClick={() => void refresh()}
            size="sm"
            variant="secondary"
            aria-label="Actualizar solicitudes de insumos"
          >
            <RefreshCcw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
        <div className="mt-4">
          <SupplyRequestsTable
            onStatusChange={canUpdate ? handleStatusChange : () => undefined}
            requests={requests}
          />
        </div>
      </Surface>
    </section>
  );
}
