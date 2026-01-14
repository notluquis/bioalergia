import { DataTable } from "@/components/data-table/DataTable";
import { useAuth } from "@/context/AuthContext";

import type { SupplyRequest } from "../types";
import { getSupplyRequestsColumns } from "./SupplyRequestsColumns";

interface SupplyRequestsTableProps {
  requests: SupplyRequest[];
  onStatusChange: (requestId: number, newStatus: SupplyRequest["status"]) => void;
}

export default function SupplyRequestsTable({ requests, onStatusChange }: SupplyRequestsTableProps) {
  const { can } = useAuth();
  const isAdmin = can("update", "SupplyRequest");

  const columns = getSupplyRequestsColumns();

  const columnVisibility = {
    user_email: isAdmin,
    admin_notes: isAdmin,
    actions: isAdmin,
  };

  return (
    <div className="bg-base-100 rounded-lg p-6 shadow-md">
      <h2 className="mb-4 text-xl font-semibold">{isAdmin ? "Todas las solicitudes" : "Solicitudes activas"}</h2>
      <DataTable
        data={requests}
        columns={columns}
        meta={{ isAdmin, onStatusChange }}
        enableToolbar={false}
        enableVirtualization={false}
        initialPinning={{ right: ["actions"] }}
        columnVisibility={columnVisibility}
        noDataMessage="No se encontraron solicitudes de insumos."
      />
    </div>
  );
}
