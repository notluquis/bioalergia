import type { ColumnDef } from "@tanstack/react-table";
import type { ChangeEvent } from "react";

import Input from "@/components/ui/Input";

import type { SupplyRequest } from "../types";
import { translateStatus } from "../utils";

interface SupplyRequestsTableMeta {
  isAdmin: boolean;
  onStatusChange: (requestId: number, newStatus: SupplyRequest["status"]) => void;
}

export const getSupplyRequestsColumns = (): ColumnDef<SupplyRequest>[] => [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ getValue }) => <span className="text-base-content font-medium">{getValue() as number}</span>,
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
    id: "brand_model",
    header: "Marca/modelo",
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
  },
  {
    accessorKey: "notes",
    header: "Notas",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "user_email",
    header: "Solicitado por",
    cell: ({ getValue, table }) => {
      const meta = table.options.meta as SupplyRequestsTableMeta;
      return meta.isAdmin ? (getValue() as string) : null;
    },
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ getValue }) => translateStatus(getValue() as SupplyRequest["status"]),
  },
  {
    accessorKey: "admin_notes",
    header: "Notas del admin",
    cell: ({ getValue, table }) => {
      const meta = table.options.meta as SupplyRequestsTableMeta;
      return meta.isAdmin ? (getValue() as string) || "-" : null;
    },
  },
  {
    accessorKey: "created_at",
    header: "Fecha solicitud",
    cell: ({ getValue }) => new Date(getValue() as string).toLocaleString(),
  },
  {
    id: "actions",
    header: "Acciones",
    cell: ({ row, table }) => {
      const meta = table.options.meta as SupplyRequestsTableMeta;
      if (!meta.isAdmin) return null;

      return (
        <Input
          as="select"
          value={row.original.status}
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            meta.onStatusChange(row.original.id, event.target.value as SupplyRequest["status"])
          }
          className="bg-base-100 border-base-300 mt-1 block w-full rounded-md py-2 pr-10 pl-3 text-base focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
        >
          <option value="pending">Pendiente</option>
          <option value="ordered">Pedido</option>
          <option value="in_transit">En tránsito</option>
          <option value="delivered">Entregado</option>
          <option value="rejected">Rechazado</option>
        </Input>
      );
    },
  },
];
