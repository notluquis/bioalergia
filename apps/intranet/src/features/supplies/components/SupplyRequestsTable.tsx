import { DataTable } from "@/components/data-table/DataTable";
import { useAuth } from "@/context/AuthContext";

import type { SupplyRequest } from "../types";

import { getSupplyRequestsColumns } from "./SupplyRequestsColumns";

interface SupplyRequestsTableProps {
  onStatusChange: (requestId: number, newStatus: SupplyRequest["status"]) => void;
  requests: SupplyRequest[];
}
export function SupplyRequestsTable({ onStatusChange, requests }: SupplyRequestsTableProps) {
  const { can } = useAuth();
  const isAdmin = can("update", "SupplyRequest");

  const columns = getSupplyRequestsColumns();

  const columnVisibility = {
    actions: isAdmin,
    admin_notes: isAdmin,
    user_email: isAdmin,
  };

  return (
    <DataTable
      columns={columns}
      columnVisibility={columnVisibility}
      data={requests}
      containerVariant="plain"
      enablePagination={false}
      enableToolbar={false}
      initialPinning={{ right: ["actions"] }}
      meta={{ isAdmin, onStatusChange }}
      noDataMessage="No se encontraron solicitudes de insumos."
    />
  );
}
