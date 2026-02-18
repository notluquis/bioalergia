import type { FinancialTransaction } from "@finanzas/db";
import { Button, Card } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { apiClient } from "@/lib/api-client";
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
  data?: FinancialTransaction[];
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
    })
    .optional(),
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
      apiClient.post<{ data?: { created?: number } }>(
        "/api/finance/sync",
        {},
        {
          responseSchema: FinancialSyncResponseSchema,
        },
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["FinancialTransaction"] });
      toast.success(`Sincronización completada: ${data.data?.created ?? 0} creados.`);
    },
    onError: () => {
      toast.error("Error al sincronizar");
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

  const { data, isLoading } = useFinancialTransactions({ page, pageSize: 50 });
  const syncMutation = useSyncTransactions();

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
            total={data?.meta?.total || 0}
            isLoading={isLoading}
            page={page}
            pageSize={50}
            onPageChange={setPage}
            onEdit={handleEdit}
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
