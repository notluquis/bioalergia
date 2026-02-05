import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { ServicesHero, ServicesSurface } from "@/features/services/components/ServicesShell";
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
      <ServicesHero
        actions={
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
        }
        description="Solicita insumos críticos y sigue el estado de aprobación y entrega."
        title="Insumos"
      />

      {canCreate && (
        <ServicesSurface>
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-foreground text-lg">Solicitar nuevo insumo</h2>
              <p className="text-default-500 text-xs">
                Selecciona el insumo y añade observaciones para el equipo de compras.
              </p>
            </div>
            <SupplyRequestForm commonSupplies={commonSupplies} onSuccess={refresh} />
          </div>
        </ServicesSurface>
      )}

      <ServicesSurface>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground text-lg">{tableTitle}</h2>
            <p className="text-default-500 text-xs">{requests.length} solicitudes en el periodo.</p>
          </div>
        </div>
        <div className="mt-4">
          <SupplyRequestsTable
            onStatusChange={canUpdate ? handleStatusChange : () => undefined}
            requests={requests}
          />
        </div>
      </ServicesSurface>
    </section>
  );
}
