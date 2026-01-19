import { useAuth } from "@/context/AuthContext";
import SupplyRequestForm from "@/features/supplies/components/SupplyRequestForm";
import SupplyRequestsTable from "@/features/supplies/components/SupplyRequestsTable";
import { useSupplyManagement } from "@/features/supplies/hooks/use-supply-management";

export default function Supplies() {
  const { can } = useAuth();
  const { commonSupplies, handleStatusChange, refresh, requests } = useSupplyManagement();

  const canCreate = can("create", "SupplyRequest");
  const canUpdate = can("update", "SupplyRequest");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {canCreate && <SupplyRequestForm commonSupplies={commonSupplies} onSuccess={refresh} />}

      <SupplyRequestsTable onStatusChange={canUpdate ? handleStatusChange : () => {}} requests={requests} />
    </div>
  );
}
