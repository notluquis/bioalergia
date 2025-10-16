import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useAuth } from "../../../context/auth-context";
import { logger } from "../../../lib/logger";
import type {
  CreateMonthlyExpensePayload,
  LinkMonthlyExpenseTransactionPayload,
  MonthlyExpense,
  MonthlyExpenseDetail,
  MonthlyExpenseStatsRow,
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
  status: Set<string>;
  category?: string | null;
};

export function useMonthlyExpenses() {
  const { hasRole } = useAuth();
  const canManage = useMemo(() => hasRole("GOD", "ADMIN"), [hasRole]);
  const canView = useMemo(() => hasRole("GOD", "ADMIN", "ANALYST", "VIEWER"), [hasRole]);

  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MonthlyExpenseDetail | null>(null);
  const [stats, setStats] = useState<MonthlyExpenseStatsRow[]>([]);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [filters, setFilters] = useState<ExpenseFilters>({ status: new Set() });

  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkForm, setLinkForm] = useState({ transactionId: "", amount: "" });
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const selectedIdRef = useRef<string | null>(null);

  const loadExpenses = useCallback(async () => {
    if (!canView) return;
    setLoadingList(true);
    setError(null);
    try {
      const statusParam = filters.status.size ? Array.from(filters.status).join(",") : undefined;
      const response = await fetchMonthlyExpenses({
        from: filters.from,
        to: filters.to,
        status: statusParam,
      });
      const normalized = response.expenses.map((item) => normalizeExpense(item));
      setExpenses(normalized);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo cargar los gastos";
      setError(message);
      logger.error("[expenses] list:error", message);
    } finally {
      setLoadingList(false);
    }
  }, [canView, filters.from, filters.status, filters.to]);

  const loadDetail = useCallback(async (publicId: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const response = await fetchMonthlyExpenseDetail(publicId);
      setDetail(normalizeExpenseDetail(response.expense));
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo obtener el detalle";
      setError(message);
      logger.error("[expenses] detail:error", message);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    if (!canView) return;
    setStatsLoading(true);
    try {
      const response = await fetchMonthlyExpenseStats({
        from: filters.from,
        to: filters.to,
        groupBy: "month",
        category: filters.category ?? undefined,
      });
      setStats(response.stats);
    } catch (err) {
      logger.error("[expenses] stats:error", err);
    } finally {
      setStatsLoading(false);
    }
  }, [canView, filters.from, filters.to, filters.category]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    loadExpenses().catch((error) => logger.error("[expenses] list:effect", error));
    loadStats().catch((error) => logger.error("[expenses] stats:effect", error));
  }, [loadExpenses, loadStats]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    loadDetail(selectedId).catch((error) => logger.error("[expenses] detail:effect", error));
  }, [selectedId, loadDetail]);

  const handleCreate = useCallback(
    async (payload: CreateMonthlyExpensePayload) => {
      setCreateError(null);
      try {
        const response = await createMonthlyExpense(payload);
        const normalized = normalizeExpenseDetail(response.expense);
        setDetail(normalized);
        setSelectedId(normalized.publicId);
        await loadExpenses();
        setCreateOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo crear el gasto";
        setCreateError(message);
        logger.error("[expenses] create:error", message);
        throw err;
      }
    },
    [loadExpenses]
  );

  const handleUpdate = useCallback(
    async (publicId: string, payload: CreateMonthlyExpensePayload) => {
      setCreateError(null);
      try {
        const response = await updateMonthlyExpense(publicId, payload);
        const normalized = normalizeExpenseDetail(response.expense);
        setDetail(normalized);
        await loadExpenses();
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo actualizar el gasto";
        setCreateError(message);
        logger.error("[expenses] update:error", message);
        throw err;
      }
    },
    [loadExpenses]
  );

  const openLinkModal = useCallback(() => {
    setLinkForm({ transactionId: "", amount: "" });
    setLinkError(null);
    setLinkModalOpen(true);
  }, []);

  const closeLinkModal = useCallback(() => {
    setLinkModalOpen(false);
  }, []);

  const handleLinkFieldChange = useCallback(
    (field: "transactionId" | "amount", event: ChangeEvent<HTMLInputElement>) => {
      setLinkForm((prev) => ({ ...prev, [field]: event.target.value }));
    },
    []
  );

  const handleLinkSubmit = useCallback(
    async (publicId: string) => {
      setLinkError(null);
      setLinking(true);
      try {
        const payload: LinkMonthlyExpenseTransactionPayload = {
          transactionId: Number(linkForm.transactionId),
          amount: linkForm.amount ? Number(linkForm.amount) : undefined,
        };
        const response = await linkMonthlyExpenseTransaction(publicId, payload);
        setDetail(normalizeExpenseDetail(response.expense));
        await loadExpenses();
        setLinkModalOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo vincular la transacción";
        setLinkError(message);
        logger.error("[expenses] link:error", message);
      } finally {
        setLinking(false);
      }
    },
    [linkForm.amount, linkForm.transactionId, loadExpenses]
  );

  const handleUnlinkSubmit = useCallback(
    async (publicId: string, transactionId: number) => {
      setLinkError(null);
      try {
        const response = await unlinkMonthlyExpenseTransaction(publicId, transactionId);
        setDetail(normalizeExpenseDetail(response.expense));
        await loadExpenses();
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo desvincular";
        setLinkError(message);
        logger.error("[expenses] unlink:error", message);
      }
    },
    [loadExpenses]
  );

  const normalizedDetail = detail ? normalizeExpenseDetail(detail) : null;

  return {
    canManage,
    canView,
    expenses,
    stats,
    statsLoading,
    selectedExpense: normalizedDetail,
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
    linking,
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
    amountApplied: expense.amountApplied,
    transactionCount: expense.transactionCount,
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
