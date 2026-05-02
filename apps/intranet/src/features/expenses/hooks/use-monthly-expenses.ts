import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { type ChangeEvent, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import {
  createExpense,
  linkExpenseTransaction,
  unlinkExpenseTransaction,
  updateExpense,
} from "../api";
import type { CreateExpensePayload } from "../api";
import { expenseKeys } from "../queries";
import type { Expense, ExpenseDetail, ExpenseScope } from "../types";

export interface ExpenseFilters {
  category?: null | string;
  from?: string;
  scope?: ExpenseScope;
  to?: string;
}

type UpdateExpensePayload = CreateExpensePayload;

export function useMonthlyExpenses() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can("update", "Expense");
  const canView = can("read", "Expense");

  const [selectedId, setSelectedId] = useState<null | string>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<null | string>(null);

  const [filters, setFilters] = useState<ExpenseFilters>({});

  const [linkError, setLinkError] = useState<null | string>(null);
  const [linkForm, setLinkForm] = useState({ amount: "", transactionId: "" });
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const selectedIdRef = useRef<null | string>(null);
  selectedIdRef.current = selectedId;

  // 1. Fetch List
  const { data: expensesResponse, isLoading: loadingList } = useSuspenseQuery(
    expenseKeys.list({
      from: filters.from,
      scope: filters.scope,
      to: filters.to,
    })
  );

  const expenses = expensesResponse.expenses as Expense[];

  // 2. Fetch Stats
  const { data: statsResponse, isLoading: statsLoading } = useSuspenseQuery(
    expenseKeys.stats({ from: filters.from, scope: filters.scope, to: filters.to })
  );

  const stats = statsResponse.stats;

  // 3. Fetch Detail (use useQuery with skipToken for conditional fetching)
  const { data: detailResponse } = useQuery({
    ...expenseKeys.detail(selectedId ?? ""),
    queryFn: selectedId ? expenseKeys.detail(selectedId).queryFn : skipToken,
  });

  const detail = detailResponse ? (detailResponse.expense as ExpenseDetail) : null;

  // Mutations
  const createMutation = useMutation({
    mutationFn: createExpense,
    onError: (err) => {
      setCreateError(err instanceof Error ? err.message : "No se pudo crear el gasto");
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      void queryClient.invalidateQueries({ queryKey: expenseKeys.allStats });
      setSelectedId(response.expense.publicId);
      setCreateOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateExpensePayload }) => {
      return updateExpense(id, payload);
    },
    onError: (err) => {
      setCreateError(err instanceof Error ? err.message : "No se pudo actualizar el gasto");
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      void queryClient.invalidateQueries({ queryKey: expenseKeys.allStats });
      queryClient.setQueryData(expenseKeys.detail(response.expense.publicId).queryKey, {
        expense: response.expense,
        status: "ok",
      });
    },
  });

  const linkMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: { amount?: number; transactionId: number };
    }) => {
      return linkExpenseTransaction(id, payload);
    },
    onError: (err) => {
      setLinkError(err instanceof Error ? err.message : "Error al vincular");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      void queryClient.invalidateQueries({ queryKey: expenseKeys.allStats });
      setLinkModalOpen(false);
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async ({ id, transactionId }: { id: string; transactionId: number }) => {
      return unlinkExpenseTransaction(id, transactionId);
    },
    onError: (err) => {
      setLinkError(err instanceof Error ? err.message : "Error al desvincular");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      void queryClient.invalidateQueries({ queryKey: expenseKeys.allStats });
    },
  });

  // Handlers
  const handleCreate = async (payload: CreateExpensePayload) => {
    setCreateError(null);
    await createMutation.mutateAsync(payload);
  };

  const handleUpdate = async (publicId: string, payload: UpdateExpensePayload) => {
    setCreateError(null);
    await updateMutation.mutateAsync({ id: publicId, payload });
  };

  const openLinkModal = () => {
    setLinkForm({ amount: "", transactionId: "" });
    setLinkError(null);
    setLinkModalOpen(true);
  };

  const closeLinkModal = () => {
    setLinkModalOpen(false);
  };

  const handleLinkFieldChange = (
    field: "amount" | "transactionId",
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setLinkForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleLinkSubmit = async (publicId: string) => {
    setLinkError(null);
    const payload: { amount?: number; transactionId: number } = {
      amount: linkForm.amount ? Number(linkForm.amount) : undefined,
      transactionId: Number(linkForm.transactionId),
    };
    await linkMutation.mutateAsync({ id: publicId, payload });
  };

  const handleUnlinkSubmit = async (publicId: string, transactionId: number) => {
    setLinkError(null);
    await unlinkMutation.mutateAsync({ id: publicId, transactionId });
  };

  return {
    canManage,
    canView,
    closeCreateModal: () => {
      setCreateOpen(false);
    },
    closeLinkModal,
    createError,
    createOpen,
    error: null as null | string,
    expenses,
    filters,
    handleCreate,
    handleLinkFieldChange,
    handleLinkSubmit,
    handleUnlinkSubmit,
    handleUpdate,
    linkError,
    linkForm,
    linking: linkMutation.isPending,
    linkModalOpen,
    loadingList,
    openCreateModal: () => {
      setCreateOpen(true);
    },
    openLinkModal,
    selectedExpense: detail ?? null,
    selectedId,
    setCreateOpen,
    setFilters,
    setSelectedId,
    stats,
    statsLoading,
  };
}
