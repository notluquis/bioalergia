import type { Counterpart, FinancialTransaction, TransactionCategory } from "@finanzas/db";
import { Chip } from "@heroui/react";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select, SelectItem } from "@/components/ui/Select";

// Extend with relations
export type TransactionWithRelations = FinancialTransaction & {
  category?: TransactionCategory | null;
  counterpart?: Counterpart | null;
};

type CashFlowTableMeta = {
  onCategoryChange?: (tx: TransactionWithRelations, categoryId: null | number) => void;
  transactionCategories?: Array<{ color?: null | string; id: number; name: string }>;
  updatingCategoryIds?: Set<number>;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
  }).format(amount);
};

export const columns: ColumnDef<TransactionWithRelations>[] = [
  {
    accessorKey: "date",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3 h-8 data-[state=open]:bg-accent"
        >
          Fecha
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => dayjs(row.getValue("date")).format("DD-MM-YY"),
  },
  {
    accessorKey: "description",
    header: "Descripción",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="text-small font-medium">{row.getValue("description")}</span>
        <span className="text-tiny text-default-400 capitalize">
          {(row.original.source || "").toLowerCase()}
        </span>
      </div>
    ),
  },
  {
    id: "source_target",
    header: "Desde / Hacia",
    cell: ({ row }) =>
      row.original.counterpart ? (
        <div className="flex flex-col">
          <span className="text-small">{row.original.counterpart.bankAccountHolder}</span>
          <span className="text-tiny text-default-400">
            {row.original.counterpart.identificationNumber}
          </span>
        </div>
      ) : (
        <span className="text-default-400">-</span>
      ),
  },
  {
    accessorKey: "type",
    header: "Tipo",
    cell: ({ row }) => {
      const type = row.getValue("type") as string;
      return (
        <Chip
          className="capitalize"
          color={type === "INCOME" ? "success" : "danger"}
          size="sm"
          variant="soft"
        >
          {type === "INCOME" ? "Ingreso" : "EGRESO"}
        </Chip>
      );
    },
  },
  {
    accessorKey: "amount",
    header: () => <div className="text-right">Monto</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"));
      return (
        <div className={`text-right font-medium ${amount >= 0 ? "text-success" : "text-danger"}`}>
          {formatCurrency(amount)}
        </div>
      );
    },
  },
  {
    accessorKey: "category",
    header: "Categoría",
    cell: ({ row, table }) => {
      const meta = table.options.meta as CashFlowTableMeta | undefined;
      const cat = row.original.category;
      const categories = meta?.transactionCategories ?? [];
      const isUpdating = meta?.updatingCategoryIds?.has(row.original.id) ?? false;
      const selectedValue =
        row.original.categoryId == null ? "__none__" : String(row.original.categoryId);

      if (categories.length === 0 || !meta?.onCategoryChange) {
        return cat ? (
          <Chip size="sm" variant="secondary">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: cat.color ?? "#ccc" }}
            />
            <Chip.Label>{cat.name}</Chip.Label>
          </Chip>
        ) : (
          <span className="text-default-300 italic">Sin categoría</span>
        );
      }

      return (
        <Select
          className="min-w-44"
          isDisabled={isUpdating}
          selectedKey={selectedValue}
          onSelectionChange={(key) => {
            const parsed = String(key);
            const categoryId = parsed === "__none__" ? null : Number(parsed);
            if (categoryId !== null && Number.isNaN(categoryId)) return;
            meta.onCategoryChange?.(row.original, categoryId);
          }}
        >
          <SelectItem id="__none__" textValue="Sin categoría">
            Sin categoría
          </SelectItem>
          {categories.map((category) => (
            <SelectItem id={String(category.id)} key={category.id} textValue={category.name}>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: category.color ?? "#ccc" }}
                />
                <span>{category.name}</span>
              </div>
            </SelectItem>
          ))}
        </Select>
      );
    },
  },
  {
    accessorKey: "comment",
    header: "Comentario",
    cell: ({ row }) => (
      <span
        className="text-small text-default-500 truncate max-w-50 block"
        title={row.getValue("comment")}
      >
        {row.getValue("comment")}
      </span>
    ),
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      // table.options.meta is typed via the global TableMeta declaration in tanstack-table.d.ts
      return (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => table.options.meta?.onEdit?.(row.original)}
        >
          Editar
        </Button>
      );
    },
  },
];
