import { useAuth } from "@/context/AuthContext";
import SupplyRequestForm from "@/features/supplies/components/SupplyRequestForm";
import SupplyRequestsTable from "@/features/supplies/components/SupplyRequestsTable";
import { useSupplyManagement } from "@/features/supplies/hooks/useSupplyManagement";

export default function Supplies() {
  const { can } = useAuth();
  const { requests, commonSupplies, loading, fetchData, handleStatusChange } = useSupplyManagement();

  const canCreate = can("create", "SupplyRequest");
  const canUpdate = can("update", "SupplyRequest");

  if (loading) return <div className="p-4">Cargando...</div>;

  return (
    <div className="mx-auto max-w-7xl p-4">
      <h1 className="mb-4 text-2xl font-bold">Solicitudes de Insumos</h1>

      {canCreate && <SupplyRequestForm commonSupplies={commonSupplies} onSuccess={fetchData} />}

      <SupplyRequestsTable requests={requests} onStatusChange={canUpdate ? handleStatusChange : () => {}} />
    </div>
  );
}
