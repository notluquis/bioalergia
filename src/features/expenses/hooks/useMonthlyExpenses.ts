import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreateMonthlyExpensePayload,
  LinkMonthlyExpenseTransactionPayload,
  MonthlyExpense,
  MonthlyExpenseDetail,
} from "../types";
import {
  createMonthlyExpense,
  fetchMonthlyExpenseDetail,
  fetchMonthlyExpenseStats,
  fetchMonthlyExpenses,
  linkMonthlyExpenseTransaction,
  unlinkMonthlyExpenseTransaction,
  updateMonthlyExpense,
} from "../api";

export type ExpenseFilters = {
  from?: string;
  to?: string;
  category?: string | null;
};

// Update payload matches Create payload for PUT operations
type UpdateMonthlyExpensePayload = CreateMonthlyExpensePayload;

export function useMonthlyExpenses() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canManage = useMemo(() => can("update", "Expense"), [can]);
  const canView = useMemo(() => can("read", "Expense"), [can]);

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
    data: expensesData,
    isLoading: loadingList,
    error: listError,
  } = useQuery({
    queryKey: ["monthly-expenses", filters.from, filters.to],
    queryFn: async () => {
      const response = await fetchMonthlyExpenses({
        from: filters.from,
        to: filters.to,
      });
      return response.expenses.map(normalizeExpense);
    },
    enabled: canView,
  });

  const expenses = useMemo(() => expensesData ?? [], [expensesData]);

  // 2. Fetch Stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["monthly-expenses-stats", filters.from, filters.to, filters.category],
    queryFn: async () => {
      const response = await fetchMonthlyExpenseStats({
        from: filters.from,
        to: filters.to,
        groupBy: "month",
        category: filters.category ?? undefined,
      });
      return response.stats;
    },
    enabled: canView,
  });

  const stats = useMemo(
    () =>
      statsData ?? {
        totalAmount: 0,
        count: 0,
        categoryBreakdown: {},
        statusBreakdown: {},
      },
    [statsData]
  );

  // 3. Fetch Detail
  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["monthly-expense-detail", selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const response = await fetchMonthlyExpenseDetail(selectedId);
      return normalizeExpenseDetail(response.expense);
    },
    enabled: !!selectedId && canView,
    staleTime: 0,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createMonthlyExpense,
    onSuccess: (response) => {
      const normalized = normalizeExpenseDetail(response.expense);
      queryClient.invalidateQueries({ queryKey: ["monthly-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-expenses-stats"] });
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
      queryClient.invalidateQueries({ queryKey: ["monthly-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-expenses-stats"] });
      queryClient.setQueryData(
        ["monthly-expense-detail", response.expense.publicId],
        normalizeExpenseDetail(response.expense)
      );
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
      queryClient.invalidateQueries({ queryKey: ["monthly-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-expenses-stats"] });
      queryClient.setQueryData(
        ["monthly-expense-detail", response.expense.publicId],
        normalizeExpenseDetail(response.expense)
      );
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
      queryClient.invalidateQueries({ queryKey: ["monthly-expenses"] });
      queryClient.invalidateQueries({ queryKey: ["monthly-expenses-stats"] });
      queryClient.setQueryData(
        ["monthly-expense-detail", response.expense.publicId],
        normalizeExpenseDetail(response.expense)
      );
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

  const error = listError ? (listError instanceof Error ? listError.message : String(listError)) : null;

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
