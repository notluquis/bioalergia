import { DataTable } from "@/components/data-table/DataTable";
import { useAuth } from "@/context/AuthContext";

import type { SupplyRequest } from "../types";

import { getSupplyRequestsColumns } from "./SupplyRequestsColumns";

interface SupplyRequestsTableProps {
  onStatusChange: (requestId: number, newStatus: SupplyRequest["status"]) => void;
  requests: SupplyRequest[];
}

export default function SupplyRequestsTable({
  onStatusChange,
  requests,
}: SupplyRequestsTableProps) {
  const { can } = useAuth();
  const isAdmin = can("update", "SupplyRequest");

  const columns = getSupplyRequestsColumns();

  const columnVisibility = {
    actions: isAdmin,
    admin_notes: isAdmin,
    user_email: isAdmin,
  };

  return (
    <div className="bg-background rounded-lg p-6 shadow-md">
      <h2 className="mb-4 text-xl font-semibold">
        {isAdmin ? "Todas las solicitudes" : "Solicitudes activas"}
      </h2>
      <DataTable
        columns={columns}
        columnVisibility={columnVisibility}
        data={requests}
        enableToolbar={false}
        enableVirtualization={false}
        initialPinning={{ right: ["actions"] }}
        meta={{ isAdmin, onStatusChange }}
        noDataMessage="No se encontraron solicitudes de insumos."
      />
    </div>
  );
}
