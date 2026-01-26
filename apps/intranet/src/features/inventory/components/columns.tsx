import type { ColumnDef } from "@tanstack/react-table";
import { Lock } from "lucide-react";

import Button from "@/components/ui/Button";

import type { InventoryItem } from "../types";

export interface InventoryTableMeta {
  canAdjust: boolean;
  canUpdate: boolean;
  openAdjustStockModal: (item: InventoryItem) => void;
  openEditModal: (item: InventoryItem) => void;
}

export const columns: ColumnDef<InventoryItem>[] = [
  {
    accessorKey: "name",
    cell: ({ row }) => <span className="text-foreground font-medium">{row.original.name}</span>,
    header: "Nombre",
  },
  {
    accessorKey: "category_name",
    cell: ({ row }) => (
      <span className="text-foreground">{row.original.category_name ?? "Sin categoría"}</span>
    ),
    header: "Categoría",
  },
  {
    accessorKey: "description",
    cell: ({ row }) => <span className="text-default-500">{row.original.description ?? "—"}</span>,
    header: "Descripción",
  },
  {
    accessorKey: "current_stock",
    cell: ({ row }) => <span className="text-foreground">{row.original.current_stock}</span>,
    header: "Stock actual",
  },
  {
    cell: ({ row, table }) => {
      const meta = table.options.meta as InventoryTableMeta;
      const { canAdjust, canUpdate, openAdjustStockModal, openEditModal } = meta;
      const item = row.original;

      return (
        <div className="flex justify-end gap-3 px-4 py-3 text-right text-xs font-semibold tracking-wide uppercase">
          <Button
            disabled={!canAdjust}
            onClick={() => {
              openAdjustStockModal(item);
            }}
            size="sm"
            title={canAdjust ? undefined : "Sin permiso"}
            variant="secondary"
          >
            {!canAdjust && <Lock className="mr-1" size={12} />}
            Ajustar stock
          </Button>
          <Button
            disabled={!canUpdate}
            onClick={() => {
              openEditModal(item);
            }}
            size="sm"
            title={canUpdate ? undefined : "Sin permiso"}
            variant="secondary"
          >
            {!canUpdate && <Lock className="mr-1" size={12} />}
            Editar
          </Button>
        </div>
      );
    },
    header: () => <div className="text-right">Acciones</div>,
    id: "actions",
  },
];
