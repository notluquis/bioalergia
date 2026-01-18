import { skipToken, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { type ChangeEvent, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";

import type {
  CreateMonthlyExpensePayload,
  LinkMonthlyExpenseTransactionPayload,
  MonthlyExpense,
  MonthlyExpenseDetail,
} from "../types";

import {
  createMonthlyExpense,
  linkMonthlyExpenseTransaction,
  unlinkMonthlyExpenseTransaction,
  updateMonthlyExpense,
} from "../api";
// Update payload matches Create payload for PUT operations
import { expenseKeys } from "../queries";

export interface ExpenseFilters {
  category?: null | string;
  from?: string;
  to?: string;
}

type UpdateMonthlyExpensePayload = CreateMonthlyExpensePayload;

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
  const { data: expensesResponse, isLoading: loadingList } = useSuspenseQuery(expenseKeys.list(filters));

  const expenses = expensesResponse.expenses.map((e) => normalizeExpense(e));

  // 2. Fetch Stats
  const { data: statsResponse, isLoading: statsLoading } = useSuspenseQuery(expenseKeys.stats(filters));

  const statsData = statsResponse.stats;

  const stats = statsData;

  // 3. Fetch Detail (use useQuery with skipToken for conditional fetching)
  const { data: detailResponse } = useQuery({
    ...expenseKeys.detail(selectedId ?? ""),
    queryFn: selectedId ? expenseKeys.detail(selectedId).queryFn : skipToken,
  });

  const detail = detailResponse ? normalizeExpenseDetail(detailResponse.expense) : null;

  // Mutations
  const createMutation = useMutation({
    mutationFn: createMonthlyExpense,
    onError: (err) => {
      setCreateError(err instanceof Error ? err.message : "No se pudo crear el gasto");
    },
    onSuccess: (response) => {
      const normalized = normalizeExpenseDetail(response.expense);
      void queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      void queryClient.invalidateQueries({ queryKey: expenseKeys.statsAll });
      setSelectedId(normalized.publicId);
      setCreateOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateMonthlyExpensePayload }) => {
      return updateMonthlyExpense(id, payload);
    },
    onError: (err) => {
      setCreateError(err instanceof Error ? err.message : "No se pudo actualizar el gasto");
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      void queryClient.invalidateQueries({ queryKey: expenseKeys.statsAll });
      queryClient.setQueryData(expenseKeys.detail(response.expense.publicId).queryKey, {
        expense: response.expense,
        status: "ok",
      });
    },
  });

  const linkMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: LinkMonthlyExpenseTransactionPayload }) => {
      return linkMonthlyExpenseTransaction(id, payload);
    },
    onError: (err) => {
      setLinkError(err instanceof Error ? err.message : "Error al vincular");
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      void queryClient.invalidateQueries({ queryKey: expenseKeys.statsAll });
      queryClient.setQueryData(expenseKeys.detail(response.expense.publicId).queryKey, {
        expense: response.expense,
        status: "ok",
      });
      setLinkModalOpen(false);
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async ({ id, transactionId }: { id: string; transactionId: number }) => {
      return unlinkMonthlyExpenseTransaction(id, transactionId);
    },
    onError: (err) => {
      setLinkError(err instanceof Error ? err.message : "Error al desvincular");
    },
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      void queryClient.invalidateQueries({ queryKey: expenseKeys.statsAll });
      queryClient.setQueryData(expenseKeys.detail(response.expense.publicId).queryKey, {
        expense: response.expense,
        status: "ok",
      });
    },
  });

  // Handlers
  const handleCreate = async (payload: CreateMonthlyExpensePayload) => {
    setCreateError(null);
    await createMutation.mutateAsync(payload);
  };

  const handleUpdate = async (publicId: string, payload: UpdateMonthlyExpensePayload) => {
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

  const handleLinkFieldChange = (field: "amount" | "transactionId", event: ChangeEvent<HTMLInputElement>) => {
    setLinkForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleLinkSubmit = async (publicId: string) => {
    setLinkError(null);
    const payload: LinkMonthlyExpenseTransactionPayload = {
      amount: linkForm.amount ? Number(linkForm.amount) : undefined,
      transactionId: Number(linkForm.transactionId),
    };
    await linkMutation.mutateAsync({ id: publicId, payload });
  };

  const handleUnlinkSubmit = async (publicId: string, transactionId: number) => {
    setLinkError(null);
    await unlinkMutation.mutateAsync({ id: publicId, transactionId });
  };

  const error = (() => {
    // listError is handled by Suspense
    return null;
  })();

  return {
    canManage,
    canView,
    closeCreateModal: () => {
      setCreateOpen(false);
    },
    closeLinkModal,
    createError,
    // loadingDetail removed (Suspense)
    createOpen,
    error,
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

function normalizeExpense(expense: MonthlyExpense): MonthlyExpense {
  return {
    ...expense,
    tags: expense.tags,
  };
}

function normalizeExpenseDetail(expense: MonthlyExpenseDetail): MonthlyExpenseDetail {
  return {
    ...normalizeExpense(expense),
    transactions: expense.transactions.map((item) => ({
      ...item,
    })),
  };
}
