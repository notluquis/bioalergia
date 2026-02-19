import type { FinancialTransaction, TransactionCategory } from "@finanzas/db";
import {
  Button,
  Card,
  ColorSwatchPicker,
  Dropdown,
  DropdownPopover,
  DropdownTrigger,
  Input,
  Label,
  ListBox,
  parseColor,
  SearchField,
  Select,
  type Selection,
  Tabs,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ApiError, apiClient } from "@/lib/api-client";
import type { TransactionWithRelations } from "../components/CashFlowColumns";
import { CashFlowTable } from "../components/CashFlowTable";
import { TransactionForm } from "../components/TransactionForm";

// Hooks
interface TransactionQueryParams {
  page: number;
  pageSize?: number;
  from?: string;
  to?: string;
  search?: string;
}

type FinancialTransactionsResponse = {
  data?: TransactionWithRelations[];
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
};

const CashFlowTransactionSchema = z
  .object({
    amount: z.number(),
    categoryId: z.number().nullable().optional(),
    comment: z.string().nullable().optional(),
    date: z.coerce.date(),
    description: z.string(),
    id: z.number(),
    source: z.string(),
    type: z.enum(["INCOME", "EXPENSE"]),
  })
  .passthrough();

const FinancialTransactionsResponseSchema = z.object({
  data: z.array(CashFlowTransactionSchema),
  meta: z
    .object({
      page: z.number(),
      pageSize: z.number(),
      total: z.number(),
      totalPages: z.number(),
    })
    .optional(),
  status: z.literal("ok"),
});

const TransactionCategorySchema = z
  .object({
    color: z.string().nullable().optional(),
    id: z.number(),
    name: z.string(),
    type: z.enum(["INCOME", "EXPENSE"]),
  })
  .passthrough();

const TransactionCategoriesResponseSchema = z.object({
  data: z.array(TransactionCategorySchema),
  status: z.literal("ok"),
});

const CreateTransactionCategoryResponseSchema = z.object({
  data: TransactionCategorySchema,
  status: z.literal("ok"),
});

const UpdateTransactionCategoryResponseSchema = z.object({
  data: TransactionCategorySchema,
  status: z.literal("ok"),
});

const DeleteTransactionCategoryResponseSchema = z.object({
  status: z.literal("ok"),
});

const UpdateTransactionResponseSchema = z.object({
  data: z.unknown().optional(),
  status: z.literal("ok"),
});

function useFinancialTransactions(params: TransactionQueryParams) {
  return useQuery({
    queryKey: ["FinancialTransaction", params],
    queryFn: () =>
      apiClient.get<FinancialTransactionsResponse>("/api/finance/transactions", {
        query: {
          from: params.from,
          page: params.page,
          pageSize: params.pageSize,
          search: params.search,
          to: params.to,
        },
        responseSchema: FinancialTransactionsResponseSchema,
      }),
  });
}

function useTransactionCategories() {
  return useQuery<TransactionCategory[]>({
    queryKey: ["TransactionCategory"],
    queryFn: async () => {
      const payload = await apiClient.get<{ data: TransactionCategory[] }>(
        "/api/finance/categories",
        {
          responseSchema: TransactionCategoriesResponseSchema,
        },
      );
      return payload.data;
    },
  });
}

export const Route = createFileRoute("/_authed/finanzas/cash-flow")({
  component: CashFlowPage,
});

type CashFlowTab = "cash-flow" | "categories";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CL", { currency: "CLP", style: "currency" }).format(amount);

const CATEGORY_COLOR_PRESETS = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#64748B",
] as const;

const TABLE_PAGE_SIZE = 50;

type CashFlowTypeFilter = "ALL" | "EXPENSE" | "INCOME";

type CashFlowColumnFilters = {
  amount: string;
  comment: string;
  fromCounterpart: string;
  description: string;
  toCounterpart: string;
  type: CashFlowTypeFilter;
};

const DEFAULT_COLUMN_FILTERS: CashFlowColumnFilters = {
  amount: "",
  comment: "",
  fromCounterpart: "",
  description: "",
  toCounterpart: "",
  type: "ALL",
};

const normalizeText = (value: null | string | undefined) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const formatMonthLabel = (monthValue: string) => {
  const date = new Date(`${monthValue}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return monthValue;
  const label = new Intl.DateTimeFormat("es-CL", {
    month: "long",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

function CategoryColorPicker({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (hex: string) => void;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <ColorSwatchPicker
          size="sm"
          value={parseColor(value)}
          onChange={(color) => onChange(color.toString("hex"))}
        >
          {CATEGORY_COLOR_PRESETS.map((color) => (
            <ColorSwatchPicker.Item key={color} color={color}>
              <ColorSwatchPicker.Swatch />
              <ColorSwatchPicker.Indicator />
            </ColorSwatchPicker.Item>
          ))}
        </ColorSwatchPicker>
        <span className="text-tiny text-default-500 uppercase">{value}</span>
      </div>
    </div>
  );
}

export function CashFlowPage() {
  const [page, setPage] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));
  const [activeTab, setActiveTab] = useState<CashFlowTab>("cash-flow");
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<string[]>([]);
  const [columnFilters, setColumnFilters] = useState<CashFlowColumnFilters>(DEFAULT_COLUMN_FILTERS);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinancialTransaction | null>(null);
  const [updatingCategoryIds, setUpdatingCategoryIds] = useState<Set<number>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [newCategoryColor, setNewCategoryColor] = useState("#64748b");
  const [editingCategoryId, setEditingCategoryId] = useState<null | number>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryType, setEditingCategoryType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [editingCategoryColor, setEditingCategoryColor] = useState("#64748b");

  const monthRange = useMemo(() => {
    const base = dayjs(`${selectedMonth}-01`);
    return {
      from: base.startOf("month").format("YYYY-MM-DD"),
      to: base.endOf("month").format("YYYY-MM-DD"),
    };
  }, [selectedMonth]);

  const monthOptions = useMemo(() => {
    const current = dayjs().startOf("month");
    return Array.from({ length: 24 }, (_item, index) => {
      const value = current.subtract(index, "month").format("YYYY-MM");
      return {
        label: formatMonthLabel(value),
        value,
      };
    });
  }, []);

  const { data, isLoading } = useFinancialTransactions({
    from: monthRange.from,
    page: 1,
    pageSize: 2500,
    to: monthRange.to,
  });
  const { data: categories = [] } = useTransactionCategories();
  const queryClient = useQueryClient();

  const categoryFilterOptions = useMemo(() => {
    const baseOptions = categories.map((category) => ({
      color: category.color ?? "#9ca3af",
      label: category.name,
      value: String(category.id),
    }));
    return [{ color: "#9ca3af", label: "Sin categoría", value: "__none__" }, ...baseOptions];
  }, [categories]);

  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategoryFilters.length === 0) {
      return "Todas";
    }
    const selectedMap = new Map(
      categoryFilterOptions.map((option) => [option.value, option.label]),
    );
    const labels = selectedCategoryFilters.map((key) => selectedMap.get(key) ?? key);
    const preview = labels.slice(0, 2).join(", ");
    if (labels.length > 2) {
      return `${preview} +${labels.length - 2}`;
    }
    return preview;
  }, [categoryFilterOptions, selectedCategoryFilters]);

  const selectedCategoryMap = useMemo(
    () => new Map(categoryFilterOptions.map((option) => [option.value, option.label])),
    [categoryFilterOptions],
  );

  const hasActiveFilters =
    selectedCategoryFilters.length > 0 ||
    columnFilters.type !== "ALL" ||
    columnFilters.description.trim().length > 0 ||
    columnFilters.fromCounterpart.trim().length > 0 ||
    columnFilters.toCounterpart.trim().length > 0 ||
    columnFilters.amount.trim().length > 0 ||
    columnFilters.comment.trim().length > 0;

  const monthTransactions = data?.data ?? [];

  const filteredTransactions = useMemo(() => {
    const descriptionFilter = normalizeText(columnFilters.description);
    const fromCounterpartFilter = normalizeText(columnFilters.fromCounterpart);
    const toCounterpartFilter = normalizeText(columnFilters.toCounterpart);
    const commentFilter = normalizeText(columnFilters.comment);
    const amountFilter = columnFilters.amount.replace(/[^\d-]/g, "").trim();

    return monthTransactions.filter((tx) => {
      if (columnFilters.type !== "ALL" && tx.type !== columnFilters.type) {
        return false;
      }

      if (selectedCategoryFilters.length > 0) {
        const txCategoryKey = tx.categoryId == null ? "__none__" : String(tx.categoryId);
        if (!selectedCategoryFilters.includes(txCategoryKey)) {
          return false;
        }
      }

      if (descriptionFilter) {
        const descriptionText = normalizeText(`${tx.description} ${tx.source ?? ""}`);
        if (!descriptionText.includes(descriptionFilter)) {
          return false;
        }
      }

      const counterpartText = normalizeText(
        tx.counterpart
          ? `${tx.counterpart.bankAccountHolder} ${tx.counterpart.identificationNumber}`
          : "",
      );

      if (
        tx.type === "INCOME" &&
        fromCounterpartFilter &&
        !counterpartText.includes(fromCounterpartFilter)
      ) {
        return false;
      }

      if (
        tx.type === "EXPENSE" &&
        toCounterpartFilter &&
        !counterpartText.includes(toCounterpartFilter)
      ) {
        return false;
      }

      if (commentFilter) {
        const commentText = normalizeText(tx.comment ?? "");
        if (!commentText.includes(commentFilter)) {
          return false;
        }
      }

      if (amountFilter) {
        const numericAmount = Number(tx.amount);
        const normalizedRawAmount = String(tx.amount).replace(/[^\d-]/g, "");
        const normalizedAmount = String(Math.round(numericAmount)).replace(/[^\d-]/g, "");
        const normalizedCurrency = formatCurrency(numericAmount).replace(/[^\d-]/g, "");
        const matchesAmount = [normalizedRawAmount, normalizedAmount, normalizedCurrency].some(
          (candidate) => candidate.includes(amountFilter),
        );
        if (!matchesAmount) {
          return false;
        }
      }

      return true;
    });
  }, [columnFilters, monthTransactions, selectedCategoryFilters]);

  const filteredSummary = useMemo(() => {
    const totals = filteredTransactions.reduce(
      (acc, tx) => {
        const amount = Number(tx.amount);
        if (tx.type === "INCOME") {
          acc.income += amount;
        } else {
          acc.expense += amount;
        }
        acc.count += 1;
        acc.net += amount;
        return acc;
      },
      { count: 0, expense: 0, income: 0, net: 0 },
    );

    const byCategoryMap = new Map<
      string,
      {
        categoryColor?: null | string;
        categoryId: null | number;
        categoryName: string;
        count: number;
        total: number;
        type: "EXPENSE" | "INCOME";
      }
    >();

    for (const tx of filteredTransactions) {
      const key = `${tx.type}-${tx.categoryId ?? "none"}`;
      const current = byCategoryMap.get(key);
      const amount = Number(tx.amount);
      if (current) {
        current.count += 1;
        current.total += amount;
      } else {
        byCategoryMap.set(key, {
          categoryColor: tx.category?.color ?? null,
          categoryId: tx.categoryId ?? null,
          categoryName: tx.category?.name ?? "Sin categoría",
          count: 1,
          total: amount,
          type: tx.type,
        });
      }
    }

    const byCategory = Array.from(byCategoryMap.values()).sort((a, b) => {
      if (a.type !== b.type) return a.type === "INCOME" ? -1 : 1;
      return Math.abs(b.total) - Math.abs(a.total);
    });

    return { byCategory, totals };
  }, [filteredTransactions]);

  const totalFiltered = filteredTransactions.length;
  const pageCount = Math.max(1, Math.ceil(totalFiltered / TABLE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  const paginatedTransactions = useMemo(() => {
    const start = (safePage - 1) * TABLE_PAGE_SIZE;
    return filteredTransactions.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredTransactions, safePage]);

  const updateTransactionCategoryMutation = useMutation({
    mutationFn: async ({
      categoryId,
      transactionId,
    }: {
      categoryId: null | number;
      transactionId: number;
    }) =>
      apiClient.put(
        `/api/finance/transactions/${transactionId}`,
        { categoryId },
        {
          responseSchema: UpdateTransactionResponseSchema,
        },
      ),
    onMutate: ({ transactionId }) => {
      setUpdatingCategoryIds((prev) => {
        const next = new Set(prev);
        next.add(transactionId);
        return next;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["FinancialTransaction"] });
    },
    onError: () => {
      toast.error("No se pudo actualizar la categoría");
    },
    onSettled: (_data, _error, variables) => {
      setUpdatingCategoryIds((prev) => {
        const next = new Set(prev);
        next.delete(variables.transactionId);
        return next;
      });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (payload: { color?: string; name: string; type: "EXPENSE" | "INCOME" }) =>
      apiClient.post("/api/finance/categories", payload, {
        responseSchema: CreateTransactionCategoryResponseSchema,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["TransactionCategory"] });
      setNewCategoryName("");
      setNewCategoryType("EXPENSE");
      setNewCategoryColor("#64748b");
      toast.success("Categoría creada");
    },
    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : "Error inesperado al crear categoría";
      toast.error(message);
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async (payload: {
      color?: null | string;
      id: number;
      name: string;
      type: "EXPENSE" | "INCOME";
    }) =>
      apiClient.put(
        `/api/finance/categories/${payload.id}`,
        {
          color: payload.color,
          name: payload.name,
          type: payload.type,
        },
        {
          responseSchema: UpdateTransactionCategoryResponseSchema,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["TransactionCategory"] });
      setEditingCategoryId(null);
      toast.success("Categoría actualizada");
    },
    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : "Error inesperado al actualizar categoría";
      toast.error(message);
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) =>
      apiClient.delete(`/api/finance/categories/${id}`, {
        responseSchema: DeleteTransactionCategoryResponseSchema,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["TransactionCategory"] });
      queryClient.invalidateQueries({ queryKey: ["FinancialTransaction"] });
      toast.success("Categoría eliminada");
    },
    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : "Error inesperado al eliminar categoría";
      toast.error(message);
    },
  });

  const handleEdit = (tx: FinancialTransaction) => {
    setEditingTx(tx);
    setIsFormOpen(true);
  };

  const handleCategoryChange = (tx: TransactionWithRelations, categoryId: null | number) => {
    updateTransactionCategoryMutation.mutate({
      categoryId,
      transactionId: tx.id,
    });
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("El nombre de la categoría es obligatorio");
      return;
    }
    createCategoryMutation.mutate({
      color: newCategoryColor || undefined,
      name,
      type: newCategoryType,
    });
  };

  const handleStartEditCategory = (category: TransactionCategory) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setEditingCategoryType(category.type === "INCOME" ? "INCOME" : "EXPENSE");
    setEditingCategoryColor(category.color ?? "#64748b");
  };

  const handleCancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName("");
    setEditingCategoryType("EXPENSE");
    setEditingCategoryColor("#64748b");
  };

  const handleSaveEditCategory = (categoryId: number) => {
    const name = editingCategoryName.trim();
    if (!name) {
      toast.error("El nombre de la categoría es obligatorio");
      return;
    }
    updateCategoryMutation.mutate({
      color: editingCategoryColor || null,
      id: categoryId,
      name,
      type: editingCategoryType,
    });
  };

  const handleDeleteCategory = (category: TransactionCategory) => {
    const confirmed = window.confirm(`¿Eliminar la categoría "${category.name}"?`);
    if (!confirmed) return;
    deleteCategoryMutation.mutate(category.id);
  };

  const updateColumnFilter = <K extends keyof CashFlowColumnFilters>(
    key: K,
    value: CashFlowColumnFilters[K],
  ) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleCategoryFilterSelection = (keys: Selection) => {
    if (keys === "all") {
      setSelectedCategoryFilters(categoryFilterOptions.map((item) => item.value));
      setPage(1);
      return;
    }
    setSelectedCategoryFilters(Array.from(keys).map(String));
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4 px-3 pb-3 pt-0">
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as CashFlowTab)}
        variant="secondary"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Flujo de caja" className="rounded-lg bg-default-50/50 p-1">
            <Tabs.Tab id="cash-flow">
              Flujo de caja
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="categories">
              Categorías
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="cash-flow" className="space-y-3 pt-3">
          <Card>
            <div className="space-y-3 p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <div className="rounded-md border border-default-200 px-2.5 py-2">
                  <p className="text-tiny text-default-500">Ingresos</p>
                  <p className="font-semibold text-success">
                    {formatCurrency(filteredSummary.totals.income)}
                  </p>
                </div>
                <div className="rounded-md border border-default-200 px-2.5 py-2">
                  <p className="text-tiny text-default-500">Egresos</p>
                  <p className="font-semibold text-danger">
                    {formatCurrency(filteredSummary.totals.expense)}
                  </p>
                </div>
                <div className="rounded-md border border-default-200 px-2.5 py-2">
                  <p className="text-tiny text-default-500">Neto</p>
                  <p
                    className={`font-semibold ${filteredSummary.totals.net >= 0 ? "text-success" : "text-danger"}`}
                  >
                    {formatCurrency(filteredSummary.totals.net)}
                  </p>
                </div>
                <div className="rounded-md border border-default-200 px-2.5 py-2">
                  <p className="text-tiny text-default-500">Movimientos</p>
                  <p className="font-semibold">{filteredSummary.totals.count}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Resumen por categoría</p>
                {isLoading ? (
                  <p className="text-sm text-default-500">Cargando resumen...</p>
                ) : filteredSummary.byCategory.length === 0 ? (
                  <p className="text-sm text-default-500">
                    No hay movimientos para los filtros seleccionados.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {filteredSummary.byCategory.map((item) => (
                      <div
                        key={`${item.type}-${item.categoryId ?? "none"}`}
                        className="rounded-md border border-default-200 px-2.5 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.categoryColor ?? "#9ca3af" }}
                            />
                            <span className="truncate text-sm">{item.categoryName}</span>
                          </div>
                          <span className="text-tiny text-default-500">
                            {item.type === "INCOME" ? "Ingreso" : "EGRESO"}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-tiny text-default-500">{item.count} mov.</span>
                          <span
                            className={`font-medium ${item.type === "INCOME" ? "text-success" : "text-danger"}`}
                          >
                            {formatCurrency(item.total)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <div className="border-b border-default-200 p-3">
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-10">
                <div className="lg:col-span-2">
                  <Select
                    selectedKey={selectedMonth}
                    onSelectionChange={(key) => {
                      setSelectedMonth(String(key));
                      setPage(1);
                    }}
                  >
                    <Label>Mes</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {monthOptions.map((monthOption) => (
                          <ListBox.Item
                            id={monthOption.value}
                            key={monthOption.value}
                            textValue={monthOption.label}
                          >
                            {monthOption.label}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                <div className="lg:col-span-4">
                  <Label className="mb-1 block">Categorías (multi)</Label>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button className="h-10 w-full justify-start text-left" variant="outline">
                        {selectedCategoryLabel}
                      </Button>
                    </DropdownTrigger>
                    <DropdownPopover>
                      <ListBox
                        className="max-h-60 w-[320px] overflow-auto"
                        selectedKeys={new Set(selectedCategoryFilters)}
                        selectionMode="multiple"
                        onSelectionChange={handleCategoryFilterSelection}
                      >
                        {categoryFilterOptions.map((option) => (
                          <ListBox.Item
                            id={option.value}
                            key={option.value}
                            textValue={option.label}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: option.color }}
                              />
                              <span>{option.label}</span>
                            </div>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </DropdownPopover>
                  </Dropdown>
                </div>

                <div className="lg:col-span-1">
                  <Select
                    selectedKey={columnFilters.type}
                    onSelectionChange={(key) =>
                      updateColumnFilter("type", String(key) as CashFlowTypeFilter)
                    }
                  >
                    <Label>Tipo</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="ALL" textValue="Todos">
                          Todos
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="INCOME" textValue="Ingreso">
                          Ingreso
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="EXPENSE" textValue="EGRESO">
                          EGRESO
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                <div className="flex items-end justify-end lg:col-span-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-default-500 hover:text-foreground"
                    onClick={() => {
                      setSelectedCategoryFilters([]);
                      setColumnFilters(DEFAULT_COLUMN_FILTERS);
                      setPage(1);
                    }}
                  >
                    Limpiar
                  </Button>
                </div>

                <SearchField
                  aria-label="Buscar en descripción"
                  className="lg:col-span-3"
                  value={columnFilters.description}
                  onChange={(value) => updateColumnFilter("description", value)}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Descripción" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>

                <SearchField
                  aria-label="Buscar en desde"
                  className="lg:col-span-2"
                  value={columnFilters.fromCounterpart}
                  onChange={(value) => updateColumnFilter("fromCounterpart", value)}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Desde" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>

                <SearchField
                  aria-label="Buscar en hacia"
                  className="lg:col-span-2"
                  value={columnFilters.toCounterpart}
                  onChange={(value) => updateColumnFilter("toCounterpart", value)}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Hacia" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>

                <SearchField
                  aria-label="Buscar por monto"
                  className="lg:col-span-1"
                  value={columnFilters.amount}
                  onChange={(value) => updateColumnFilter("amount", value)}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Monto" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>

                <SearchField
                  aria-label="Buscar en comentario"
                  className="lg:col-span-1"
                  value={columnFilters.comment}
                  onChange={(value) => updateColumnFilter("comment", value)}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Comentario" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </div>

              {hasActiveFilters && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {selectedCategoryFilters.map((categoryKey) => (
                    <Button
                      key={categoryKey}
                      className="h-7 rounded-full px-3"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedCategoryFilters((prev) =>
                          prev.filter((key) => key !== categoryKey),
                        );
                        setPage(1);
                      }}
                    >
                      {selectedCategoryMap.get(categoryKey) ?? categoryKey}
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  ))}

                  {columnFilters.type !== "ALL" && (
                    <Button
                      className="h-7 rounded-full px-3"
                      size="sm"
                      variant="outline"
                      onClick={() => updateColumnFilter("type", "ALL")}
                    >
                      {columnFilters.type === "INCOME" ? "Ingreso" : "EGRESO"}
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {columnFilters.description.trim().length > 0 && (
                    <Button
                      className="h-7 rounded-full px-3"
                      size="sm"
                      variant="outline"
                      onClick={() => updateColumnFilter("description", "")}
                    >
                      Descripción: {columnFilters.description}
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {columnFilters.fromCounterpart.trim().length > 0 && (
                    <Button
                      className="h-7 rounded-full px-3"
                      size="sm"
                      variant="outline"
                      onClick={() => updateColumnFilter("fromCounterpart", "")}
                    >
                      Desde: {columnFilters.fromCounterpart}
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {columnFilters.toCounterpart.trim().length > 0 && (
                    <Button
                      className="h-7 rounded-full px-3"
                      size="sm"
                      variant="outline"
                      onClick={() => updateColumnFilter("toCounterpart", "")}
                    >
                      Hacia: {columnFilters.toCounterpart}
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {columnFilters.amount.trim().length > 0 && (
                    <Button
                      className="h-7 rounded-full px-3"
                      size="sm"
                      variant="outline"
                      onClick={() => updateColumnFilter("amount", "")}
                    >
                      Monto: {columnFilters.amount}
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {columnFilters.comment.trim().length > 0 && (
                    <Button
                      className="h-7 rounded-full px-3"
                      size="sm"
                      variant="outline"
                      onClick={() => updateColumnFilter("comment", "")}
                    >
                      Comentario: {columnFilters.comment}
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="p-0">
              <CashFlowTable
                data={paginatedTransactions}
                categories={categories}
                total={totalFiltered}
                isLoading={isLoading}
                page={safePage}
                pageSize={TABLE_PAGE_SIZE}
                onPageChange={(nextPage) => setPage(Math.max(1, nextPage))}
                onEdit={handleEdit}
                onCategoryChange={handleCategoryChange}
                updatingCategoryIds={updatingCategoryIds}
              />
            </div>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel id="categories" className="space-y-3 pt-3">
          <Card>
            <div className="p-3">
              <form
                className="grid grid-cols-1 gap-4 md:grid-cols-4"
                onSubmit={handleCreateCategory}
              >
                <TextField className="md:col-span-2">
                  <Label>Nombre</Label>
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Ej: Honorarios médicos"
                  />
                </TextField>

                <Select
                  selectedKey={newCategoryType}
                  onSelectionChange={(key) =>
                    setNewCategoryType(String(key) as "EXPENSE" | "INCOME")
                  }
                  placeholder="Tipo"
                >
                  <Label>Tipo</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="INCOME" textValue="Ingreso">
                        Ingreso
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="EXPENSE" textValue="EGRESO">
                        EGRESO
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>

                <CategoryColorPicker
                  label="Color"
                  value={newCategoryColor}
                  onChange={setNewCategoryColor}
                />

                <div className="md:col-span-4">
                  <Button type="submit" isPending={createCategoryMutation.isPending}>
                    {({ isPending }) => (isPending ? "Creando..." : "Crear categoría")}
                  </Button>
                </div>
              </form>
            </div>
          </Card>

          <Card>
            <div className="p-3">
              {categories.length === 0 ? (
                <p className="text-default-500 text-sm">No hay categorías creadas.</p>
              ) : (
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between rounded-md border border-default-200 px-3 py-2"
                    >
                      {editingCategoryId === category.id ? (
                        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-[1fr_160px_90px_auto] md:items-end">
                          <TextField>
                            <Label>Nombre</Label>
                            <Input
                              value={editingCategoryName}
                              onChange={(e) => setEditingCategoryName(e.target.value)}
                            />
                          </TextField>
                          <Select
                            selectedKey={editingCategoryType}
                            onSelectionChange={(key) =>
                              setEditingCategoryType(String(key) as "EXPENSE" | "INCOME")
                            }
                          >
                            <Label>Tipo</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                <ListBox.Item id="INCOME" textValue="Ingreso">
                                  Ingreso
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                                <ListBox.Item id="EXPENSE" textValue="EGRESO">
                                  EGRESO
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              </ListBox>
                            </Select.Popover>
                          </Select>
                          <CategoryColorPicker
                            label="Color"
                            value={editingCategoryColor}
                            onChange={setEditingCategoryColor}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => handleCancelEditCategory()}
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onPress={() => handleSaveEditCategory(category.id)}
                              isPending={updateCategoryMutation.isPending}
                            >
                              Guardar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: category.color ?? "#ccc" }}
                            />
                            <span>{category.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-default-500 text-sm">
                              {category.type === "INCOME" ? "Ingreso" : "EGRESO"}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onPress={() => handleStartEditCategory(category)}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-danger"
                              onPress={() => handleDeleteCategory(category)}
                              isPending={deleteCategoryMutation.isPending}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </Tabs.Panel>
      </Tabs>

      <TransactionForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialData={editingTx}
      />
    </div>
  );
}
