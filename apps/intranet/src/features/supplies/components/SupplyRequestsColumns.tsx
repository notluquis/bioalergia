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
    cell: ({ getValue }) => (
      <span className="text-foreground font-medium">{getValue() as number}</span>
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
      if (!meta.isAdmin) return null;

      return (
        <Input
          as="select"
          className="bg-background border-default-200 mt-1 block w-full rounded-md py-2 pr-10 pl-3 text-base focus:border-indigo-500 focus:ring-indigo-500 focus:outline-none sm:text-sm"
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            meta.onStatusChange(row.original.id, event.target.value as SupplyRequest["status"]);
          }}
          value={row.original.status}
        >
          <option value="pending">Pendiente</option>
          <option value="ordered">Pedido</option>
          <option value="in_transit">En tránsito</option>
          <option value="delivered">Entregado</option>
          <option value="rejected">Rechazado</option>
        </Input>
      );
    },
    header: "Acciones",
    id: "actions",
  },
];
