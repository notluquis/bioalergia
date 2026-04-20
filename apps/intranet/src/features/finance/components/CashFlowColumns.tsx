import { Button, Checkbox, Chip, Label, ListBox, Select } from "@heroui/react";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ArrowRightLeft, ArrowUpDown, Check, Minus, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { isNonAccountableCategory } from "../utils/non-accountable-category";

export type TransactionCategoryOption = {
  color?: null | string;
  icon?: null | string;
  id: number;
  name: string;
  type: "INCOME" | "EXPENSE";
};

export type CounterpartOption = {
  bankAccountHolder: string;
  id: number;
  identificationNumber: string;
};

export type CashFlowTransaction = {
  amount: number | string;
  category?: null | TransactionCategoryOption;
  categoryId: null | number;
  comment?: null | string;
  counterpart?: CounterpartOption | null;
  counterpartAccountNumber?: null | string;
  counterpartId?: null | number;
  createdAt?: Date;
  date: Date;
  description: string;
  hasReallocation?: boolean;
  hasReallocationInEffectivePeriod?: boolean;
  id: number;
  reallocatedInEffectivePeriod?: number;
  reallocatedInTotal?: number;
  reallocatedOutEffectivePeriod?: number;
  reallocatedOutTotal?: number;
  releaseBalanceAmount?: null | number | string;
  releasePaymentMethod?: null | string;
  releaseSaleDetail?: null | string;
  settlementPaymentMethod?: null | string;
  settlementPaymentMethodType?: null | string;
  settlementSaleDetail?: null | string;
  sourceId?: null | string;
  type: "INCOME" | "EXPENSE";
  updatedAt?: Date;
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
  rawMethodType: null | string | undefined
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
const COMMENT_REF_PREFIX_REGEX = /^ref:\s*/i;

const normalizeCommentDetail = (rawValue: null | string | undefined) =>
  (rawValue ?? "").replace(COMMENT_REF_PREFIX_REGEX, "").trim();

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

function SelectionCheckbox(props: {
  ariaLabel: string;
  isIndeterminate?: boolean;
  isSelected: boolean;
  onChange: () => void;
}) {
  return (
    <Checkbox
      aria-label={props.ariaLabel}
      className="justify-center"
      isIndeterminate={props.isIndeterminate}
      isSelected={props.isSelected}
      slot="selection"
      variant="secondary"
      onChange={props.onChange}
    >
      <Checkbox.Control className="border border-default-300/70 bg-default-200/50 shadow-none transition-colors data-[selected=true]:border-transparent data-[selected=true]:bg-accent data-[indeterminate=true]:border-transparent data-[indeterminate=true]:bg-accent">
        <Checkbox.Indicator>
          {({ isIndeterminate, isSelected }) => {
            if (isIndeterminate) {
              return <Minus className="h-3.5 w-3.5 text-white" strokeWidth={3} />;
            }

            return isSelected ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /> : null;
          }}
        </Checkbox.Indicator>
      </Checkbox.Control>
      <Checkbox.Content className="sr-only">
        <Label>{props.ariaLabel}</Label>
      </Checkbox.Content>
    </Checkbox>
  );
}

export const columns: ColumnDef<CashFlowTransaction>[] = [
  {
    id: "select",
    enableResizing: false,
    enableSorting: false,
    header: ({ table }) => {
      const allSelected = table.getIsAllPageRowsSelected();
      const someSelected = table.getIsSomePageRowsSelected();

      return (
        <SelectionCheckbox
          aria-label="Seleccionar movimientos de la página actual"
          isIndeterminate={!allSelected && someSelected}
          isSelected={allSelected}
          onChange={() => table.toggleAllPageRowsSelected(!allSelected)}
        />
      );
    },
    cell: ({ row }) => (
      <SelectionCheckbox
        aria-label={`Seleccionar movimiento ${row.original.id}`}
        isSelected={row.getIsSelected()}
        onChange={() => row.toggleSelected(!row.getIsSelected())}
      />
    ),
    maxSize: 44,
    minSize: 44,
    size: 44,
  },
  {
    accessorKey: "date",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onPress={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
        row.original.settlementPaymentMethodType
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
        <div className="flex max-w-70 min-w-0 flex-col">
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
      const outInPeriod = Number(row.original.reallocatedOutEffectivePeriod ?? 0);
      const inInPeriod = Number(row.original.reallocatedInEffectivePeriod ?? 0);
      const outTotal = Number(row.original.reallocatedOutTotal ?? 0);
      const inTotal = Number(row.original.reallocatedInTotal ?? 0);
      const hasPeriodIndicator =
        (row.original.hasReallocationInEffectivePeriod ?? false) &&
        (outInPeriod > 0 || inInPeriod > 0);
      const hasGlobalIndicator =
        (row.original.hasReallocation ?? false) && (outTotal > 0 || inTotal > 0);
      const activeOut = hasPeriodIndicator ? outInPeriod : outTotal;
      const activeIn = hasPeriodIndicator ? inInPeriod : inTotal;

      return (
        <div className="flex flex-col items-end gap-1">
          <div className={`text-right font-medium ${amount >= 0 ? "text-success" : "text-danger"}`}>
            {formatCurrency(amount)}
          </div>
          {(hasPeriodIndicator || hasGlobalIndicator) && activeOut > 0 ? (
            <Chip
              color="danger"
              size="sm"
              title="Monto arrastrado hacia otros períodos"
              variant="soft"
            >
              Arrastrado {formatCurrency(activeOut)}
            </Chip>
          ) : null}
          {(hasPeriodIndicator || hasGlobalIndicator) && activeIn > 0 ? (
            <Chip
              color="success"
              size="sm"
              title="Monto traído desde otros períodos"
              variant="soft"
            >
              Traído {formatCurrency(activeIn)}
            </Chip>
          ) : null}
        </div>
      );
    },
  },
  {
    accessorKey: "category",
    header: "Categoría",
    maxSize: 340,
    minSize: 240,
    size: 280,
    cell: ({ row, table }) => {
      const meta = table.options.meta;
      const cat = row.original.category;
      const allCategories = meta?.transactionCategories ?? [];
      const typeFilteredCategories = allCategories.filter(
        (category) => category.type == null || category.type === row.original.type
      );
      const categories = typeFilteredCategories.length > 0 ? typeFilteredCategories : allCategories;
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
            <Chip.Label>
              <span>{cat.name}</span>
              {isNonAccountableCategory(cat) ? (
                <Chip className="ml-1" color="warning" size="sm" variant="soft">
                  No contabilizable
                </Chip>
              ) : null}
            </Chip.Label>
          </Chip>
        ) : (
          <span className="text-default-300 italic">Sin categoría</span>
        );
      }

      return (
        <Select
          className="min-w-56"
          isDisabled={isUpdating}
          key={`${row.original.id}:${selectedValue}`}
          value={selectedValue}
          onChange={(key) => {
            const parsed = String(key ?? "__none__");
            const categoryId = parsed === "__none__" ? null : Number(parsed);
            if (categoryId !== null && Number.isNaN(categoryId)) return;
            meta.onCategoryChange?.(row.original, categoryId);
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="__none__" key="__none__" textValue="Sin categoría">
                Sin categoría
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {categories.map((category) => (
                <ListBox.Item id={String(category.id)} key={category.id} textValue={category.name}>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: category.color ?? "#ccc" }}
                    />
                    <span>{category.name}</span>
                    {isNonAccountableCategory(category) ? (
                      <Chip color="warning" size="sm" variant="soft">
                        No contabilizable
                      </Chip>
                    ) : null}
                  </div>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
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
    enableResizing: false,
    header: "",
    maxSize: 108,
    minSize: 96,
    size: 96,
    cell: ({ row, table }) => {
      // table.options.meta is typed via the global TableMeta declaration in tanstack-table.d.ts
      return (
        <div className="flex justify-center gap-1">
          <Button
            aria-label="Reasignar periodo"
            className="h-7 w-7 min-w-7 p-0"
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={() => table.options.meta?.onReallocate?.(row.original)}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            aria-label="Editar movimiento"
            className="h-7 w-7 min-w-7 p-0"
            isIconOnly
            size="sm"
            variant="ghost"
            onPress={() => table.options.meta?.onEdit?.(row.original)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    },
  },
];
