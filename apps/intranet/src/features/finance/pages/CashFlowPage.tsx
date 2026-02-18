import type { FinancialTransaction, TransactionCategory } from "@finanzas/db";
import { Button, Card } from "@heroui/react";
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
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
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
  })
  .passthrough();

const TransactionCategoriesResponseSchema = z.object({
  data: z.array(TransactionCategorySchema),
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

export function CashFlowPage() {
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinancialTransaction | null>(null);
  const [updatingCategoryIds, setUpdatingCategoryIds] = useState<Set<number>>(new Set());

  const { data, isLoading } = useFinancialTransactions({ page, pageSize: 50 });
  const { data: categories = [] } = useTransactionCategories();
  const syncMutation = useSyncTransactions();
  const queryClient = useQueryClient();

  const updateCategoryMutation = useMutation({
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

  const handleEdit = (tx: FinancialTransaction) => {
    setEditingTx(tx);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingTx(null);
    setIsFormOpen(true);
  };

  const handleSync = () => {
    syncMutation.mutate();
  };

  const handleCategoryChange = (tx: TransactionWithRelations, categoryId: null | number) => {
    updateCategoryMutation.mutate({
      categoryId,
      transactionId: tx.id,
    });
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button variant="secondary" onPress={handleSync} isPending={syncMutation.isPending}>
            {({ isPending }) => (isPending ? "Sincronizando..." : "Sincronizar Datos (MP)")}
          </Button>
          <Button onPress={handleCreate}>Agregar Movimiento</Button>
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

      <TransactionForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialData={editingTx}
      />
    </div>
  );
}
