import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { type ChangeEvent, useRef, useState } from "react";

import { useAuth } from "@/context/AuthContext";

import {
  createMonthlyExpense,
  linkMonthlyExpenseTransaction,
  unlinkMonthlyExpenseTransaction,
  updateMonthlyExpense,
} from "../api";
// Update payload matches Create payload for PUT operations
import { expenseKeys } from "../queries";
import type {
  CreateMonthlyExpensePayload,
  LinkMonthlyExpenseTransactionPayload,
  MonthlyExpense,
  MonthlyExpenseDetail,
} from "../types";

export type ExpenseFilters = {
  from?: string;
  to?: string;
  category?: string | null;
};

type UpdateMonthlyExpensePayload = CreateMonthlyExpensePayload;

export function useMonthlyExpenses() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can("update", "Expense");
  const canView = can("read", "Expense");

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ExpenseFilters>({});

  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkForm, setLinkForm] = useState({ transactionId: "", amount: "" });
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  // 1. Fetch List
  const {
    data: expensesResponse,
    isLoading: loadingList,
    error: listError,
  } = useSuspenseQuery(expenseKeys.list(filters));

  const expenses = expensesResponse?.expenses?.map((e) => normalizeExpense(e)) ?? [];

  // 2. Fetch Stats
  const { data: statsResponse, isLoading: statsLoading } = useSuspenseQuery(expenseKeys.stats(filters));

  const statsData = statsResponse?.stats;

  const stats = statsData ?? {
    totalAmount: 0,
    count: 0,
    categoryBreakdown: {},
    statusBreakdown: {},
  };

  // 3. Fetch Detail
  const { data: detailResponse, isLoading: loadingDetail } = useQuery(expenseKeys.detail(selectedId ?? ""));

  const detail = detailResponse ? normalizeExpenseDetail(detailResponse.expense) : null;

  // Mutations
  const createMutation = useMutation({
    mutationFn: createMonthlyExpense,
    onSuccess: (response) => {
      const normalized = normalizeExpenseDetail(response.expense);
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      queryClient.invalidateQueries({ queryKey: expenseKeys.statsAll });
      setSelectedId(normalized.publicId);
      setCreateOpen(false);
    },
    onError: (err) => {
      setCreateError(err instanceof Error ? err.message : "No se pudo crear el gasto");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateMonthlyExpensePayload }) => {
      return updateMonthlyExpense(id, payload);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      queryClient.invalidateQueries({ queryKey: expenseKeys.statsAll });
      queryClient.setQueryData(expenseKeys.detail(response.expense.publicId).queryKey, {
        status: "ok",
        expense: response.expense,
      });
    },
    onError: (err) => {
      setCreateError(err instanceof Error ? err.message : "No se pudo actualizar el gasto");
    },
  });

  const linkMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: LinkMonthlyExpenseTransactionPayload }) => {
      return linkMonthlyExpenseTransaction(id, payload);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      queryClient.invalidateQueries({ queryKey: expenseKeys.statsAll });
      queryClient.setQueryData(expenseKeys.detail(response.expense.publicId).queryKey, {
        status: "ok",
        expense: response.expense,
      });
      setLinkModalOpen(false);
    },
    onError: (err) => {
      setLinkError(err instanceof Error ? err.message : "Error al vincular");
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async ({ id, transactionId }: { id: string; transactionId: number }) => {
      return unlinkMonthlyExpenseTransaction(id, transactionId);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
      queryClient.invalidateQueries({ queryKey: expenseKeys.statsAll });
      queryClient.setQueryData(expenseKeys.detail(response.expense.publicId).queryKey, {
        status: "ok",
        expense: response.expense,
      });
    },
    onError: (err) => {
      setLinkError(err instanceof Error ? err.message : "Error al desvincular");
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
    setLinkForm({ transactionId: "", amount: "" });
    setLinkError(null);
    setLinkModalOpen(true);
  };

  const closeLinkModal = () => {
    setLinkModalOpen(false);
  };

  const handleLinkFieldChange = (field: "transactionId" | "amount", event: ChangeEvent<HTMLInputElement>) => {
    setLinkForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleLinkSubmit = async (publicId: string) => {
    setLinkError(null);
    const payload: LinkMonthlyExpenseTransactionPayload = {
      transactionId: Number(linkForm.transactionId),
      amount: linkForm.amount ? Number(linkForm.amount) : undefined,
    };
    await linkMutation.mutateAsync({ id: publicId, payload });
  };

  const handleUnlinkSubmit = async (publicId: string, transactionId: number) => {
    setLinkError(null);
    await unlinkMutation.mutateAsync({ id: publicId, transactionId });
  };

  const error = (() => {
    if (listError instanceof Error) return listError.message;
    return listError ? String(listError) : null;
  })();

  return {
    canManage,
    canView,
    expenses,
    stats,
    statsLoading,
    selectedExpense: detail ?? null,
    selectedId,
    setSelectedId,
    loadingList,
    loadingDetail,
    createOpen,
    setCreateOpen,
    createError,
    handleCreate,
    handleUpdate,
    filters,
    setFilters,
    linkModalOpen,
    openLinkModal,
    closeLinkModal,
    linking: linkMutation.isPending,
    linkError,
    linkForm,
    handleLinkFieldChange,
    handleLinkSubmit,
    handleUnlinkSubmit,
    openCreateModal: () => setCreateOpen(true),
    closeCreateModal: () => setCreateOpen(false),
    error,
  };
}

function normalizeExpense(expense: MonthlyExpense): MonthlyExpense {
  return {
    ...expense,
    tags: expense.tags ?? [],
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
