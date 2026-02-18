import type { Counterpart, FinancialTransaction, TransactionCategory } from "@finanzas/db";
import { Autocomplete, Chip, EmptyState, ListBox, SearchField } from "@heroui/react";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/Button";

// Extend with relations
export type TransactionWithRelations = FinancialTransaction & {
  category?: TransactionCategory | null;
  counterpart?: Counterpart | null;
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
      const meta = table.options.meta;
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
        <Autocomplete
          className="min-w-56"
          isDisabled={isUpdating}
          placeholder="Sin categoría"
          selectionMode="single"
          value={selectedValue === "__none__" ? null : selectedValue}
          onChange={(key) => {
            if (key == null) {
              meta.onCategoryChange?.(row.original, null);
              return;
            }
            const parsed = String(key);
            const categoryId = parsed === "__none__" ? null : Number(parsed);
            if (categoryId !== null && Number.isNaN(categoryId)) return;
            meta.onCategoryChange?.(row.original, categoryId);
          }}
        >
          <Autocomplete.Trigger>
            <Autocomplete.Value />
            <Autocomplete.ClearButton />
            <Autocomplete.Indicator />
          </Autocomplete.Trigger>
          <Autocomplete.Popover>
            <Autocomplete.Filter
              filter={(text, input) => text.toLowerCase().includes(input.toLowerCase())}
            >
              <SearchField autoFocus name="search-category" variant="secondary">
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder="Buscar categoría..." />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
              <ListBox renderEmptyState={() => <EmptyState>Sin resultados</EmptyState>}>
                <ListBox.Item id="__none__" textValue="Sin categoría">
                  Sin categoría
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                {categories.map((category) => (
                  <ListBox.Item
                    id={String(category.id)}
                    key={category.id}
                    textValue={category.name}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: category.color ?? "#ccc" }}
                      />
                      <span>{category.name}</span>
                    </div>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Autocomplete.Filter>
          </Autocomplete.Popover>
        </Autocomplete>
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
