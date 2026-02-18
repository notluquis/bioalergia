import type { FinancialTransaction, TransactionCategory } from "@finanzas/db";
import { Button, Card, Input, Label, ListBox, Select, Tabs, TextField } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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

const FinancialSyncResponseSchema = z.object({
  data: z
    .object({
      created: z.number().optional(),
      duplicates: z.number().optional(),
      failed: z.number().optional(),
      total: z.number().optional(),
      errors: z.array(z.string()).optional(),
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

function useSyncTransactions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post<{
        data?: {
          created?: number;
          duplicates?: number;
          failed?: number;
          total?: number;
          errors?: string[];
        };
      }>(
        "/api/finance/sync",
        {},
        {
          responseSchema: FinancialSyncResponseSchema,
        },
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["FinancialTransaction"] });
      const created = data.data?.created ?? 0;
      const duplicates = data.data?.duplicates ?? 0;
      const failed = data.data?.failed ?? 0;
      const total = data.data?.total ?? created + duplicates + failed;
      if (failed > 0) {
        toast.warning(
          `Sincronización parcial: ${created} creados, ${duplicates} duplicados, ${failed} con error (${total} total).`,
        );
        return;
      }
      toast.success(
        `Sincronización completada: ${created} creados, ${duplicates} duplicados (${total} total).`,
      );
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Error inesperado al sincronizar";
      toast.error(`Error al sincronizar: ${message}`);
    },
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

export function CashFlowPage() {
  const [page, setPage] = useState(1);
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

  const { data, isLoading } = useFinancialTransactions({ page, pageSize: 50 });
  const { data: categories = [] } = useTransactionCategories();
  const syncMutation = useSyncTransactions();
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

  const handleSync = () => {
    syncMutation.mutate();
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
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button variant="secondary" onPress={handleSync} isPending={syncMutation.isPending}>
                {({ isPending }) => (isPending ? "Sincronizando..." : "Sincronizar Datos (MP)")}
              </Button>
            </div>
          </div>

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
                      <ListBox.Item id="EXPENSE" textValue="Gasto">
                        Gasto
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
                                <ListBox.Item id="EXPENSE" textValue="Gasto">
                                  Gasto
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
                              {category.type === "INCOME" ? "Ingreso" : "Gasto"}
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
