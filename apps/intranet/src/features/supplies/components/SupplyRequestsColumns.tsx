import type { ColumnDef } from "@tanstack/react-table";
import { Select, SelectItem } from "@/components/ui/Select";

import type { SupplyRequest } from "../types";

import { translateStatus } from "../utils";

interface SupplyRequestsTableMeta {
  isAdmin: boolean;
  onStatusChange: (requestId: number, newStatus: SupplyRequest["status"]) => void;
}

export const getSupplyRequestsColumns = (): ColumnDef<SupplyRequest>[] => [
  {
    accessorKey: "id",
    cell: ({ getValue }) => (
      <span className="font-medium text-foreground">{getValue() as number}</span>
    ),
    header: "ID",
  },
  {
    accessorKey: "supply_name",
    header: "Insumo",
  },
  {
    accessorKey: "quantity",
    header: "Cantidad",
  },
  {
    cell: ({ row }) => {
      const { brand, model } = row.original;
      return (
        <span>
          {brand && <span>{brand}</span>}
          {brand && model && <span>/</span>}
          {model && <span>{model}</span>}
        </span>
      );
    },
    header: "Marca/modelo",
    id: "brand_model",
  },
  {
    accessorKey: "notes",
    cell: ({ getValue }) => getValue() || "-",
    header: "Notas",
  },
  {
    accessorKey: "user_email",
    cell: ({ getValue, table }) => {
      const meta = table.options.meta as SupplyRequestsTableMeta;
      return meta.isAdmin ? (getValue() as string) : null;
    },
    header: "Solicitado por",
  },
  {
    accessorKey: "status",
    cell: ({ getValue }) => translateStatus(getValue() as SupplyRequest["status"]),
    header: "Estado",
  },
  {
    accessorKey: "admin_notes",
    cell: ({ getValue, table }) => {
      const meta = table.options.meta as SupplyRequestsTableMeta;
      return meta.isAdmin ? (getValue() as string) || "-" : null;
    },
    header: "Notas del admin",
  },
  {
    accessorKey: "created_at",
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleString(),
    header: "Fecha solicitud",
  },
  {
    cell: ({ row, table }) => {
      const meta = table.options.meta as SupplyRequestsTableMeta;
      if (!meta.isAdmin) {
        return null;
      }

      return (
        <Select
          className="min-w-35"
          onChange={(key) => {
            // eslint-disable-next-line n/no-callback-literal
            meta.onStatusChange(row.original.id, key as SupplyRequest["status"]);
          }}
          value={row.original.status}
        >
          <SelectItem key="pending">Pendiente</SelectItem>
          <SelectItem key="ordered">Pedido</SelectItem>
          <SelectItem key="in_transit">En tránsito</SelectItem>
          <SelectItem key="delivered">Entregado</SelectItem>
          <SelectItem key="rejected">Rechazado</SelectItem>
        </Select>
      );
    },
    header: "Acciones",
    id: "actions",
  },
];
