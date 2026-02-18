import type { FinancialTransaction } from "@finanzas/db";
import { Button, Card } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
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

function unwrapApiPayload<T>(raw: unknown): T {
  if (raw && typeof raw === "object" && "json" in raw) {
    return (raw as { json: T }).json;
  }
  return raw as T;
}

function useFinancialTransactions(params: TransactionQueryParams) {
  return useQuery({
    queryKey: ["FinancialTransaction", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", params.page.toString());
      if (params.pageSize) searchParams.set("pageSize", params.pageSize.toString());
      if (params.from) searchParams.set("from", params.from);
      if (params.to) searchParams.set("to", params.to);
      if (params.search) searchParams.set("search", params.search);

      const res = await fetch(`/api/finance/transactions?${searchParams.toString()}`);
      if (!res.ok) throw new Error("Network response was not ok");
      const raw = await res.json();
      return unwrapApiPayload<FinancialTransactionsResponse>(raw);
    },
  });
}

function useSyncTransactions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finance/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      const raw = await res.json();
      return unwrapApiPayload<{ data?: { created?: number } }>(raw);
    },
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
        <div>
          <h1 className="text-2xl font-bold">Flujo de Caja</h1>
          <p className="text-default-500">Gestión de ingresos y gastos unificados</p>
        </div>
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
