import { ColumnDef } from "@tanstack/react-table";
import { Lock } from "lucide-react";

import Button from "@/components/ui/Button";

import { InventoryItem } from "../types";

export interface InventoryTableMeta {
  openAdjustStockModal: (item: InventoryItem) => void;
  openEditModal: (item: InventoryItem) => void;
  canUpdate: boolean;
  canAdjust: boolean;
}

export const columns: ColumnDef<InventoryItem>[] = [
  {
    accessorKey: "name",
    header: "Nombre",
    cell: ({ row }) => <span className="text-base-content font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "category_name",
    header: "Categoría",
    cell: ({ row }) => <span className="text-base-content">{row.original.category_name ?? "Sin categoría"}</span>,
  },
  {
    accessorKey: "description",
    header: "Descripción",
    cell: ({ row }) => <span className="text-base-content/60">{row.original.description ?? "—"}</span>,
  },
  {
    accessorKey: "current_stock",
    header: "Stock actual",
    cell: ({ row }) => <span className="text-base-content">{row.original.current_stock}</span>,
  },
  {
    id: "actions",
    header: () => <div className="text-right">Acciones</div>,
    cell: ({ row, table }) => {
      const meta = table.options.meta as InventoryTableMeta;
      const { canAdjust, canUpdate, openAdjustStockModal, openEditModal } = meta;
      const item = row.original;

      return (
        <div className="flex justify-end gap-3 px-4 py-3 text-right text-xs font-semibold tracking-wide uppercase">
          <Button
            variant="secondary"
            onClick={() => openAdjustStockModal(item)}
            disabled={!canAdjust}
            title={canAdjust ? undefined : "Sin permiso"}
            size="sm"
          >
            {!canAdjust && <Lock size={12} className="mr-1" />}
            Ajustar stock
          </Button>
          <Button
            variant="secondary"
            onClick={() => openEditModal(item)}
            disabled={!canUpdate}
            title={canUpdate ? undefined : "Sin permiso"}
            size="sm"
          >
            {!canUpdate && <Lock size={12} className="mr-1" />}
            Editar
          </Button>
        </div>
      );
    },
  },
];
