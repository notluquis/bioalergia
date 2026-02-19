import type { Counterpart, FinancialTransaction, TransactionCategory } from "@finanzas/db";
import { Autocomplete, Chip, EmptyState, ListBox, SearchField } from "@heroui/react";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ArrowUpDown, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

// Extend with relations
export type TransactionWithRelations = FinancialTransaction & {
  category?: TransactionCategory | null;
  counterpart?: Counterpart | null;
  counterpartAccountNumber?: null | string;
  releaseBalanceAmount?: null | number | string;
  releasePaymentMethod?: null | string;
  releaseSaleDetail?: null | string;
  settlementPaymentMethod?: null | string;
  settlementPaymentMethodType?: null | string;
  settlementSaleDetail?: null | string;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
  }).format(amount);
};

const normalizeComparable = (value: null | string | undefined) =>
  value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";

function renderUnifiedValue(params: {
  primary: null | string | undefined;
  primaryLabel: string;
  secondary: null | string | undefined;
  secondaryLabel: string;
}): ReactNode {
  const primaryRaw = params.primary?.trim() ?? "";
  const secondaryRaw = params.secondary?.trim() ?? "";
  const primaryNorm = normalizeComparable(primaryRaw);
  const secondaryNorm = normalizeComparable(secondaryRaw);

  if (!primaryNorm && !secondaryNorm) {
    return <span className="text-default-400">-</span>;
  }

  if (primaryNorm && secondaryNorm && primaryNorm === secondaryNorm) {
    return (
      <span className="block max-w-60 truncate text-small text-default-600" title={primaryRaw}>
        {primaryRaw}
      </span>
    );
  }

  if (primaryNorm && secondaryNorm) {
    return (
      <div className="flex max-w-72 flex-col gap-1 text-small">
        <span className="truncate text-default-600" title={`${params.primaryLabel}: ${primaryRaw}`}>
          <span className="text-tiny text-default-400">{params.primaryLabel}: </span>
          {primaryRaw}
        </span>
        <span
          className="truncate text-default-600"
          title={`${params.secondaryLabel}: ${secondaryRaw}`}
        >
          <span className="text-tiny text-default-400">{params.secondaryLabel}: </span>
          {secondaryRaw}
        </span>
      </div>
    );
  }

  const single = primaryNorm ? primaryRaw : secondaryRaw;
  return (
    <span className="block max-w-60 truncate text-small text-default-600" title={single}>
      {single}
    </span>
  );
}

const mapPaymentMethodLabel = (
  rawMethod: null | string | undefined,
  rawMethodType: null | string | undefined,
) => {
  const method = normalizeComparable(rawMethod);
  const methodType = normalizeComparable(rawMethodType);

  if (method === "available_money") return "Dinero disponible";
  if (method === "tef" || method === "bank_transfer") return "Transferencia";
  if (method === "master" || method === "mastercard") {
    return methodType === "debit_card" ? "Débito MasterCard" : "MasterCard";
  }
  if (method === "debmaster") return "Débito MasterCard";
  if (method === "debvisa") return "Débito VISA";
  if (method === "visa") {
    return methodType === "debit_card" ? "Débito VISA" : "VISA";
  }
  if (method) return rawMethod?.trim() ?? "";

  if (methodType === "bank_transfer") return "Transferencia";
  if (methodType === "available_money") return "Dinero disponible";
  return "";
};

const normalizeSaleDetail = (rawValue: null | string | undefined) =>
  (rawValue ?? "").replaceAll('"', "").trim();

const normalizeCommentDetail = (rawValue: null | string | undefined) =>
  (rawValue ?? "").replace(/^ref:\s*/i, "").trim();

const dedupeDetails = (values: string[]) => {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const raw = value.trim();
    if (!raw) continue;
    const key = normalizeComparable(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(raw);
  }

  return result;
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
    cell: ({ row }) => dayjs(row.getValue("date")).format("DD-MM-YY HH:mm"),
  },
  {
    accessorKey: "sourceId",
    header: "source_id",
    cell: ({ row }) => (
      <span
        className="block max-w-60 truncate text-small text-default-600"
        title={row.original.sourceId ?? ""}
      >
        {row.original.sourceId ?? "-"}
      </span>
    ),
  },
  {
    id: "payment_method",
    header: "payment_method",
    cell: ({ row }) => {
      const releaseMethod = mapPaymentMethodLabel(row.original.releasePaymentMethod, null);
      const settlementMethod = mapPaymentMethodLabel(
        row.original.settlementPaymentMethod,
        row.original.settlementPaymentMethodType,
      );
      return renderUnifiedValue({
        primary: releaseMethod,
        primaryLabel: "Release",
        secondary: settlementMethod,
        secondaryLabel: "Settlement",
      });
    },
  },
  {
    id: "details",
    header: "Detalles",
    cell: ({ row }) => {
      const detailLines = dedupeDetails([
        normalizeSaleDetail(row.original.releaseSaleDetail),
        normalizeSaleDetail(row.original.settlementSaleDetail),
        normalizeCommentDetail(row.original.comment),
      ]);

      if (detailLines.length === 0) {
        return <span className="text-default-400">-</span>;
      }

      if (detailLines.length === 1) {
        return (
          <span
            className="block max-w-60 truncate text-small text-default-600"
            title={detailLines[0]}
          >
            {detailLines[0]}
          </span>
        );
      }

      return (
        <div className="flex max-w-72 flex-col gap-1 text-small text-default-600">
          {detailLines.map((line) => (
            <span className="block truncate" key={line} title={line}>
              {line}
            </span>
          ))}
        </div>
      );
    },
  },
  {
    id: "source_target",
    header: "Desde / Hacia",
    maxSize: 320,
    minSize: 180,
    size: 240,
    cell: ({ row }) =>
      row.original.counterpart ? (
        <div className="flex max-w-[280px] min-w-0 flex-col">
          <span
            className="block truncate text-small"
            title={row.original.counterpart.bankAccountHolder}
          >
            {row.original.counterpart.bankAccountHolder}
          </span>
          <span
            className="block truncate text-tiny text-default-400"
            title={row.original.counterpart.identificationNumber}
          >
            {row.original.counterpart.identificationNumber}
          </span>
          <span
            className="block truncate text-tiny text-default-400"
            title={row.original.counterpartAccountNumber ?? "-"}
          >
            {row.original.counterpartAccountNumber ?? "-"}
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
          {type === "INCOME" ? "Ingreso" : "Egreso"}
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
    id: "release_balance_amount",
    header: "balance_amount",
    cell: ({ row }) => {
      const raw = row.original.releaseBalanceAmount;
      if (raw == null) return <span className="text-default-400">-</span>;
      const amount = Number(raw);
      if (!Number.isFinite(amount)) return <span className="text-default-400">-</span>;
      return <span className="font-medium text-small">{formatCurrency(amount)}</span>;
    },
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      // table.options.meta is typed via the global TableMeta declaration in tanstack-table.d.ts
      return (
        <Button
          aria-label="Editar movimiento"
          className="h-7 w-7 min-w-7 p-0"
          isIconOnly
          size="sm"
          title="Editar"
          variant="ghost"
          onClick={() => table.options.meta?.onEdit?.(row.original)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      );
    },
  },
];
