import type { FinancialTransaction, TransactionCategory } from "@finanzas/db";
import { Button, Card, Input, Label, ListBox, Select, Tabs, TextField } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
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

type FinancialSummaryByCategoryResponse = {
  byCategory: Array<{
    categoryColor?: null | string;
    categoryId: null | number;
    categoryName: string;
    count: number;
    total: number;
    type: "EXPENSE" | "INCOME";
  }>;
  totals: {
    count: number;
    expense: number;
    income: number;
    net: number;
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

const FinancialSummaryByCategoryResponseSchema = z.object({
  byCategory: z.array(
    z.object({
      categoryColor: z.string().nullable().optional(),
      categoryId: z.number().nullable(),
      categoryName: z.string(),
      count: z.number(),
      total: z.number(),
      type: z.enum(["INCOME", "EXPENSE"]),
    }),
  ),
  status: z.literal("ok"),
  totals: z.object({
    count: z.number(),
    expense: z.number(),
    income: z.number(),
    net: z.number(),
  }),
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

function useFinancialSummaryByCategory(params: { from: string; to: string }) {
  return useQuery<FinancialSummaryByCategoryResponse>({
    queryKey: ["FinancialTransactionSummary", params],
    queryFn: () =>
      apiClient.get<FinancialSummaryByCategoryResponse>("/api/finance/transactions/summary", {
        query: {
          from: params.from,
          to: params.to,
        },
        responseSchema: FinancialSummaryByCategoryResponseSchema,
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

const formatMonthLabel = (monthValue: string) => {
  const date = new Date(`${monthValue}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return monthValue;
  const label = new Intl.DateTimeFormat("es-CL", {
    month: "long",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export function CashFlowPage() {
  const [page, setPage] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));
  const [activeTab, setActiveTab] = useState<CashFlowTab>("cash-flow");
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
    page,
    pageSize: 50,
    to: monthRange.to,
  });
  const { data: summaryData, isLoading: isSummaryLoading } =
    useFinancialSummaryByCategory(monthRange);
  const { data: categories = [] } = useTransactionCategories();
  const queryClient = useQueryClient();

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

  return (
    <div className="flex flex-col gap-6 p-4">
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

        <Tabs.Panel id="cash-flow" className="space-y-4 pt-4">
          <div className="flex justify-end items-end gap-4">
            <div className="w-full max-w-60">
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
          </div>

          <Card>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="rounded-md border border-default-200 px-3 py-2">
                  <p className="text-tiny text-default-500">Ingresos</p>
                  <p className="font-semibold text-success">
                    {formatCurrency(summaryData?.totals.income ?? 0)}
                  </p>
                </div>
                <div className="rounded-md border border-default-200 px-3 py-2">
                  <p className="text-tiny text-default-500">Egresos</p>
                  <p className="font-semibold text-danger">
                    {formatCurrency(summaryData?.totals.expense ?? 0)}
                  </p>
                </div>
                <div className="rounded-md border border-default-200 px-3 py-2">
                  <p className="text-tiny text-default-500">Neto</p>
                  <p
                    className={`font-semibold ${(summaryData?.totals.net ?? 0) >= 0 ? "text-success" : "text-danger"}`}
                  >
                    {formatCurrency(summaryData?.totals.net ?? 0)}
                  </p>
                </div>
                <div className="rounded-md border border-default-200 px-3 py-2">
                  <p className="text-tiny text-default-500">Movimientos</p>
                  <p className="font-semibold">{summaryData?.totals.count ?? 0}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Resumen por categoría</p>
                {isSummaryLoading ? (
                  <p className="text-sm text-default-500">Cargando resumen...</p>
                ) : (summaryData?.byCategory.length ?? 0) === 0 ? (
                  <p className="text-sm text-default-500">
                    No hay movimientos para el mes seleccionado.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {(summaryData?.byCategory ?? []).map((item) => (
                      <div
                        key={`${item.type}-${item.categoryId ?? "none"}`}
                        className="rounded-md border border-default-200 px-3 py-2"
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
            <div className="p-0">
              <CashFlowTable
                data={data?.data || []}
                categories={categories}
                total={data?.meta?.total || 0}
                isLoading={isLoading}
                page={page}
                pageSize={50}
                onPageChange={setPage}
                onEdit={handleEdit}
                onCategoryChange={handleCategoryChange}
                updatingCategoryIds={updatingCategoryIds}
              />
            </div>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel id="categories" className="space-y-4 pt-4">
          <Card>
            <div className="p-4">
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

                <TextField>
                  <Label>Color</Label>
                  <Input
                    type="color"
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                  />
                </TextField>

                <div className="md:col-span-4">
                  <Button type="submit" isPending={createCategoryMutation.isPending}>
                    {({ isPending }) => (isPending ? "Creando..." : "Crear categoría")}
                  </Button>
                </div>
              </form>
            </div>
          </Card>

          <Card>
            <div className="p-4">
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
                          <TextField>
                            <Label>Color</Label>
                            <Input
                              type="color"
                              value={editingCategoryColor}
                              onChange={(e) => setEditingCategoryColor(e.target.value)}
                            />
                          </TextField>
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
