import SupplyRequestForm from "../features/supplies/components/SupplyRequestForm";
import SupplyRequestsTable from "../features/supplies/components/SupplyRequestsTable";
import { useSupplyManagement } from "../features/supplies/hooks/useSupplyManagement";

export default function Supplies() {
  const { requests, commonSupplies, loading, fetchData, handleStatusChange } = useSupplyManagement();

  if (loading) return <div className="p-4">Cargando...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Solicitudes de Insumos</h1>

      <SupplyRequestForm commonSupplies={commonSupplies} onSuccess={fetchData} />

      <SupplyRequestsTable requests={requests} onStatusChange={handleStatusChange} />
    </div>
  );
}
