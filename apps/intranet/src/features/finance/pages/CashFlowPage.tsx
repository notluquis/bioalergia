import type { FinancialTransaction, TransactionCategory } from "@finanzas/db";
import {
  Button,
  Card,
  ColorSwatchPicker,
  Dropdown,
  DropdownPopover,
  DropdownTrigger,
  Input,
  Label,
  ListBox,
  parseColor,
  SearchField,
  Select,
  type Selection,
  Skeleton,
  Tabs,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
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

type CounterpartOption = {
  bankAccountHolder: string;
  id: number;
  identificationNumber: string;
};

type FinancialAutoCategoryRule = {
  category: TransactionCategory;
  categoryId: number;
  commentContains?: null | string;
  counterpart?: CounterpartOption | null;
  counterpartId?: null | number;
  descriptionContains?: null | string;
  id: number;
  isActive: boolean;
  maxAmount?: null | number;
  minAmount?: null | number;
  name: string;
  priority: number;
  type: "EXPENSE" | "INCOME";
};

const CashFlowTransactionSchema = z
  .object({
    amount: z.number(),
    categoryId: z.number().nullable().optional(),
    comment: z.string().nullable().optional(),
    date: z.coerce.date(),
    description: z.string(),
    id: z.number(),
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

const CounterpartSchema = z.object({
  bankAccountHolder: z.string(),
  id: z.number(),
  identificationNumber: z.string(),
});

const CounterpartsResponseSchema = z.object({
  counterparts: z.array(CounterpartSchema),
  status: z.literal("ok"),
});

const FinancialAutoCategoryRuleSchema = z.object({
  category: TransactionCategorySchema,
  categoryId: z.number(),
  commentContains: z.string().nullable().optional(),
  counterpart: CounterpartSchema.nullable().optional(),
  counterpartId: z.number().nullable().optional(),
  descriptionContains: z.string().nullable().optional(),
  id: z.number(),
  isActive: z.boolean(),
  maxAmount: z.number().nullable().optional(),
  minAmount: z.number().nullable().optional(),
  name: z.string(),
  priority: z.number(),
  type: z.enum(["INCOME", "EXPENSE"]),
});

const AutoCategoryRulesResponseSchema = z.object({
  data: z.array(FinancialAutoCategoryRuleSchema),
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

const CreateAutoCategoryRuleResponseSchema = z.object({
  data: FinancialAutoCategoryRuleSchema,
  status: z.literal("ok"),
});

const UpdateAutoCategoryRuleResponseSchema = z.object({
  data: FinancialAutoCategoryRuleSchema,
  status: z.literal("ok"),
});

const DeleteAutoCategoryRuleResponseSchema = z.object({
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

function useCounterparts() {
  return useQuery<CounterpartOption[]>({
    queryKey: ["Counterpart"],
    queryFn: async () => {
      const payload = await apiClient.get<{ counterparts: CounterpartOption[] }>(
        "/api/counterparts",
        {
          responseSchema: CounterpartsResponseSchema,
        },
      );
      return payload.counterparts;
    },
  });
}

function useFinancialAutoCategoryRules() {
  return useQuery<FinancialAutoCategoryRule[]>({
    queryKey: ["FinancialAutoCategoryRule"],
    queryFn: async () => {
      const payload = await apiClient.get<{ data: FinancialAutoCategoryRule[] }>(
        "/api/finance/auto-category-rules",
        {
          responseSchema: AutoCategoryRulesResponseSchema,
        },
      );
      return payload.data;
    },
  });
}

export const Route = createFileRoute("/_authed/finanzas/cash-flow")({
  component: CashFlowPage,
});

type CashFlowTab = "cash-flow" | "categories" | "movements";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-CL", { currency: "CLP", style: "currency" }).format(amount);

const CATEGORY_COLOR_PRESETS = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#64748B",
] as const;

const TABLE_PAGE_SIZE = 50;

const PIE_COLORS = [
  "#2563EB",
  "#0891B2",
  "#0D9488",
  "#16A34A",
  "#CA8A04",
  "#EA580C",
  "#DC2626",
  "#9333EA",
  "#64748B",
] as const;

type CashFlowTypeFilter = "ALL" | "EXPENSE" | "INCOME";

type CashFlowColumnFilters = {
  amount: string;
  comment: string;
  fromCounterpart: string;
  description: string;
  toCounterpart: string;
  type: CashFlowTypeFilter;
};

const DEFAULT_COLUMN_FILTERS: CashFlowColumnFilters = {
  amount: "",
  comment: "",
  fromCounterpart: "",
  description: "",
  toCounterpart: "",
  type: "ALL",
};

const normalizeText = (value: null | string | undefined) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const formatMonthLabel = (monthValue: string) => {
  const date = new Date(`${monthValue}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return monthValue;
  const label = new Intl.DateTimeFormat("es-CL", {
    month: "long",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

type SummaryByCategoryEntry = {
  categoryColor?: null | string;
  categoryId: null | number;
  categoryName: string;
  count: number;
  total: number;
  type: "EXPENSE" | "INCOME";
};

type PieCategoryDatum = {
  color: string;
  name: string;
  value: number;
};

function buildSummary(transactions: TransactionWithRelations[]) {
  const totals = transactions.reduce(
    (acc, tx) => {
      const amount = Number(tx.amount);
      if (tx.type === "INCOME") {
        acc.income += amount;
      } else {
        acc.expense += amount;
      }
      acc.count += 1;
      acc.net += amount;
      return acc;
    },
    { count: 0, expense: 0, income: 0, net: 0 },
  );

  const byCategoryMap = new Map<string, SummaryByCategoryEntry>();

  for (const tx of transactions) {
    const key = `${tx.type}-${tx.categoryId ?? "none"}`;
    const current = byCategoryMap.get(key);
    const amount = Number(tx.amount);
    if (current) {
      current.count += 1;
      current.total += amount;
    } else {
      byCategoryMap.set(key, {
        categoryColor: tx.category?.color ?? null,
        categoryId: tx.categoryId ?? null,
        categoryName: tx.category?.name ?? "Sin categoría",
        count: 1,
        total: amount,
        type: tx.type,
      });
    }
  }

  const byCategory = Array.from(byCategoryMap.values()).sort(
    (a, b) => Math.abs(b.total) - Math.abs(a.total),
  );

  return { byCategory, totals };
}

function buildPieCategoryData(
  items: SummaryByCategoryEntry[],
  type: "EXPENSE" | "INCOME",
): PieCategoryDatum[] {
  return items
    .filter((item) => item.type === type)
    .map((item, index) => ({
      color: item.categoryColor ?? PIE_COLORS[index % PIE_COLORS.length] ?? "#64748B",
      name: item.categoryName,
      value: Math.abs(item.total),
    }))
    .filter((item) => item.value > 0);
}

function CategoryColorPicker({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (hex: string) => void;
  value: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <ColorSwatchPicker
          size="sm"
          value={parseColor(value)}
          onChange={(color) => onChange(color.toString("hex"))}
        >
          {CATEGORY_COLOR_PRESETS.map((color) => (
            <ColorSwatchPicker.Item key={color} color={color}>
              <ColorSwatchPicker.Swatch />
              <ColorSwatchPicker.Indicator />
            </ColorSwatchPicker.Item>
          ))}
        </ColorSwatchPicker>
        <span className="text-tiny text-default-500 uppercase">{value}</span>
      </div>
    </div>
  );
}

export function CashFlowPage() {
  const [page, setPage] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));
  const [activeTab, setActiveTab] = useState<CashFlowTab>("cash-flow");
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<string[]>([]);
  const [columnFilters, setColumnFilters] = useState<CashFlowColumnFilters>(DEFAULT_COLUMN_FILTERS);
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
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleCounterpartId, setNewRuleCounterpartId] = useState<null | number>(null);
  const [newRuleCategoryId, setNewRuleCategoryId] = useState<null | number>(null);
  const [newRuleType, setNewRuleType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [newRulePriority, setNewRulePriority] = useState("0");
  const [newRuleMinAmount, setNewRuleMinAmount] = useState("");
  const [newRuleMaxAmount, setNewRuleMaxAmount] = useState("");
  const [newRuleCommentContains, setNewRuleCommentContains] = useState("");
  const [newRuleDescriptionContains, setNewRuleDescriptionContains] = useState("");
  const [editingRuleId, setEditingRuleId] = useState<null | number>(null);
  const [editingRuleName, setEditingRuleName] = useState("");
  const [editingRuleCounterpartId, setEditingRuleCounterpartId] = useState<null | number>(null);
  const [editingRuleCategoryId, setEditingRuleCategoryId] = useState<null | number>(null);
  const [editingRuleType, setEditingRuleType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [editingRulePriority, setEditingRulePriority] = useState("0");
  const [editingRuleIsActive, setEditingRuleIsActive] = useState(true);
  const [editingRuleMinAmount, setEditingRuleMinAmount] = useState("");
  const [editingRuleMaxAmount, setEditingRuleMaxAmount] = useState("");
  const [editingRuleCommentContains, setEditingRuleCommentContains] = useState("");
  const [editingRuleDescriptionContains, setEditingRuleDescriptionContains] = useState("");

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
    page: 1,
    pageSize: 2500,
    to: monthRange.to,
  });
  const { data: categories = [] } = useTransactionCategories();
  const { data: counterparts = [] } = useCounterparts();
  const { data: autoCategoryRules = [] } = useFinancialAutoCategoryRules();
  const queryClient = useQueryClient();

  const categoryFilterOptions = useMemo(() => {
    const baseOptions = categories.map((category) => ({
      color: category.color ?? "#9ca3af",
      label: category.name,
      value: String(category.id),
    }));
    return [{ color: "#9ca3af", label: "Sin categoría", value: "__none__" }, ...baseOptions];
  }, [categories]);

  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategoryFilters.length === 0) {
      return "Todas";
    }
    const selectedMap = new Map(
      categoryFilterOptions.map((option) => [option.value, option.label]),
    );
    const labels = selectedCategoryFilters.map((key) => selectedMap.get(key) ?? key);
    const preview = labels.slice(0, 2).join(", ");
    if (labels.length > 2) {
      return `${preview} +${labels.length - 2}`;
    }
    return preview;
  }, [categoryFilterOptions, selectedCategoryFilters]);

  const selectedCategoryMap = useMemo(
    () => new Map(categoryFilterOptions.map((option) => [option.value, option.label])),
    [categoryFilterOptions],
  );

  const counterpartOptions = useMemo(
    () =>
      counterparts.map((counterpart) => ({
        label: `${counterpart.bankAccountHolder} (${counterpart.identificationNumber})`,
        value: counterpart.id,
      })),
    [counterparts],
  );

  const categoryOptionsByType = useMemo(
    () => ({
      EXPENSE: categories.filter((category) => category.type === "EXPENSE"),
      INCOME: categories.filter((category) => category.type === "INCOME"),
    }),
    [categories],
  );

  const hasActiveFilters =
    selectedCategoryFilters.length > 0 ||
    columnFilters.type !== "ALL" ||
    columnFilters.description.trim().length > 0 ||
    columnFilters.fromCounterpart.trim().length > 0 ||
    columnFilters.toCounterpart.trim().length > 0 ||
    columnFilters.amount.trim().length > 0 ||
    columnFilters.comment.trim().length > 0;

  const monthTransactions = data?.data ?? [];

  const filteredTransactions = useMemo(() => {
    const descriptionFilter = normalizeText(columnFilters.description);
    const fromCounterpartFilter = normalizeText(columnFilters.fromCounterpart);
    const toCounterpartFilter = normalizeText(columnFilters.toCounterpart);
    const commentFilter = normalizeText(columnFilters.comment);
    const amountFilter = columnFilters.amount.replace(/[^\d-]/g, "").trim();

    return monthTransactions.filter((tx) => {
      if (columnFilters.type !== "ALL" && tx.type !== columnFilters.type) {
        return false;
      }

      if (selectedCategoryFilters.length > 0) {
        const txCategoryKey = tx.categoryId == null ? "__none__" : String(tx.categoryId);
        if (!selectedCategoryFilters.includes(txCategoryKey)) {
          return false;
        }
      }

      if (descriptionFilter) {
        const descriptionText = normalizeText(tx.description);
        if (!descriptionText.includes(descriptionFilter)) {
          return false;
        }
      }

      const counterpartText = normalizeText(
        tx.counterpart
          ? `${tx.counterpart.bankAccountHolder} ${tx.counterpart.identificationNumber}`
          : "",
      );

      if (
        tx.type === "INCOME" &&
        fromCounterpartFilter &&
        !counterpartText.includes(fromCounterpartFilter)
      ) {
        return false;
      }

      if (
        tx.type === "EXPENSE" &&
        toCounterpartFilter &&
        !counterpartText.includes(toCounterpartFilter)
      ) {
        return false;
      }

      if (commentFilter) {
        const commentText = normalizeText(tx.comment ?? "");
        if (!commentText.includes(commentFilter)) {
          return false;
        }
      }

      if (amountFilter) {
        const numericAmount = Number(tx.amount);
        const normalizedRawAmount = String(tx.amount).replace(/[^\d-]/g, "");
        const normalizedAmount = String(Math.round(numericAmount)).replace(/[^\d-]/g, "");
        const normalizedCurrency = formatCurrency(numericAmount).replace(/[^\d-]/g, "");
        const matchesAmount = [normalizedRawAmount, normalizedAmount, normalizedCurrency].some(
          (candidate) => candidate.includes(amountFilter),
        );
        if (!matchesAmount) {
          return false;
        }
      }

      return true;
    });
  }, [columnFilters, monthTransactions, selectedCategoryFilters]);

  const monthlySummary = useMemo(() => buildSummary(monthTransactions), [monthTransactions]);
  const incomePieData = useMemo(
    () => buildPieCategoryData(monthlySummary.byCategory, "INCOME"),
    [monthlySummary.byCategory],
  );
  const expensePieData = useMemo(
    () => buildPieCategoryData(monthlySummary.byCategory, "EXPENSE"),
    [monthlySummary.byCategory],
  );

  const totalFiltered = filteredTransactions.length;
  const pageCount = Math.max(1, Math.ceil(totalFiltered / TABLE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  const paginatedTransactions = useMemo(() => {
    const start = (safePage - 1) * TABLE_PAGE_SIZE;
    return filteredTransactions.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredTransactions, safePage]);

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

  const createAutoCategoryRuleMutation = useMutation({
    mutationFn: async (payload: {
      categoryId: number;
      commentContains?: null | string;
      counterpartId?: null | number;
      descriptionContains?: null | string;
      isActive: boolean;
      maxAmount?: null | number;
      minAmount?: null | number;
      name: string;
      priority: number;
      type: "EXPENSE" | "INCOME";
    }) =>
      apiClient.post("/api/finance/auto-category-rules", payload, {
        responseSchema: CreateAutoCategoryRuleResponseSchema,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["FinancialAutoCategoryRule"] }),
        queryClient.invalidateQueries({ queryKey: ["FinancialTransaction"] }),
      ]);
      setNewRuleName("");
      setNewRuleCounterpartId(null);
      setNewRuleCategoryId(null);
      setNewRuleType("EXPENSE");
      setNewRulePriority("0");
      setNewRuleMinAmount("");
      setNewRuleMaxAmount("");
      setNewRuleCommentContains("");
      setNewRuleDescriptionContains("");
      toast.success("Regla automática creada");
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Error al crear regla";
      toast.error(message);
    },
  });

  const updateAutoCategoryRuleMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<{
        categoryId: number;
        commentContains?: null | string;
        counterpartId?: null | number;
        descriptionContains?: null | string;
        isActive: boolean;
        maxAmount?: null | number;
        minAmount?: null | number;
        name: string;
        priority: number;
        type: "EXPENSE" | "INCOME";
      }>;
    }) =>
      apiClient.put(`/api/finance/auto-category-rules/${id}`, payload, {
        responseSchema: UpdateAutoCategoryRuleResponseSchema,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["FinancialAutoCategoryRule"] }),
        queryClient.invalidateQueries({ queryKey: ["FinancialTransaction"] }),
      ]);
      setEditingRuleId(null);
      toast.success("Regla automática actualizada");
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Error al actualizar regla";
      toast.error(message);
    },
  });

  const deleteAutoCategoryRuleMutation = useMutation({
    mutationFn: async (id: number) =>
      apiClient.delete(`/api/finance/auto-category-rules/${id}`, {
        responseSchema: DeleteAutoCategoryRuleResponseSchema,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["FinancialAutoCategoryRule"] }),
        queryClient.invalidateQueries({ queryKey: ["FinancialTransaction"] }),
      ]);
      toast.success("Regla automática eliminada");
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Error al eliminar regla";
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

  const handleCreateAutoCategoryRule = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newRuleName.trim();
    if (!name) {
      toast.error("El nombre de la regla es obligatorio");
      return;
    }
    if (newRuleCategoryId == null) {
      toast.error("Selecciona una categoría");
      return;
    }
    const parsedPriority = Number.parseInt(newRulePriority, 10);
    const parsedMinAmount = Number.parseFloat(newRuleMinAmount);
    const parsedMaxAmount = Number.parseFloat(newRuleMaxAmount);
    createAutoCategoryRuleMutation.mutate({
      categoryId: newRuleCategoryId,
      commentContains: newRuleCommentContains.trim() || null,
      counterpartId: newRuleCounterpartId,
      descriptionContains: newRuleDescriptionContains.trim() || null,
      isActive: true,
      maxAmount: Number.isNaN(parsedMaxAmount) ? null : parsedMaxAmount,
      minAmount: Number.isNaN(parsedMinAmount) ? null : parsedMinAmount,
      name,
      priority: Number.isNaN(parsedPriority) ? 0 : parsedPriority,
      type: newRuleType,
    });
  };

  const handleStartEditRule = (rule: FinancialAutoCategoryRule) => {
    setEditingRuleId(rule.id);
    setEditingRuleName(rule.name);
    setEditingRuleCounterpartId(rule.counterpartId ?? null);
    setEditingRuleCategoryId(rule.categoryId);
    setEditingRuleType(rule.type);
    setEditingRulePriority(String(rule.priority));
    setEditingRuleIsActive(rule.isActive);
    setEditingRuleMinAmount(rule.minAmount == null ? "" : String(rule.minAmount));
    setEditingRuleMaxAmount(rule.maxAmount == null ? "" : String(rule.maxAmount));
    setEditingRuleCommentContains(rule.commentContains ?? "");
    setEditingRuleDescriptionContains(rule.descriptionContains ?? "");
  };

  const handleCancelEditRule = () => {
    setEditingRuleId(null);
    setEditingRuleName("");
    setEditingRuleCounterpartId(null);
    setEditingRuleCategoryId(null);
    setEditingRuleType("EXPENSE");
    setEditingRulePriority("0");
    setEditingRuleIsActive(true);
    setEditingRuleMinAmount("");
    setEditingRuleMaxAmount("");
    setEditingRuleCommentContains("");
    setEditingRuleDescriptionContains("");
  };

  const handleSaveEditRule = (ruleId: number) => {
    const name = editingRuleName.trim();
    if (!name) {
      toast.error("El nombre de la regla es obligatorio");
      return;
    }
    if (editingRuleCategoryId == null) {
      toast.error("Selecciona una categoría");
      return;
    }
    const parsedPriority = Number.parseInt(editingRulePriority, 10);
    const parsedMinAmount = Number.parseFloat(editingRuleMinAmount);
    const parsedMaxAmount = Number.parseFloat(editingRuleMaxAmount);
    updateAutoCategoryRuleMutation.mutate({
      id: ruleId,
      payload: {
        categoryId: editingRuleCategoryId,
        commentContains: editingRuleCommentContains.trim() || null,
        counterpartId: editingRuleCounterpartId,
        descriptionContains: editingRuleDescriptionContains.trim() || null,
        isActive: editingRuleIsActive,
        maxAmount: Number.isNaN(parsedMaxAmount) ? null : parsedMaxAmount,
        minAmount: Number.isNaN(parsedMinAmount) ? null : parsedMinAmount,
        name,
        priority: Number.isNaN(parsedPriority) ? 0 : parsedPriority,
        type: editingRuleType,
      },
    });
  };

  const handleDeleteRule = (rule: FinancialAutoCategoryRule) => {
    const confirmed = window.confirm(`¿Eliminar la regla "${rule.name}"?`);
    if (!confirmed) return;
    deleteAutoCategoryRuleMutation.mutate(rule.id);
  };

  const updateColumnFilter = <K extends keyof CashFlowColumnFilters>(
    key: K,
    value: CashFlowColumnFilters[K],
  ) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleCategoryFilterSelection = (keys: Selection) => {
    if (keys === "all") {
      setSelectedCategoryFilters(categoryFilterOptions.map((item) => item.value));
      setPage(1);
      return;
    }
    setSelectedCategoryFilters(Array.from(keys).map(String));
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4 px-3 pb-3 pt-0">
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as CashFlowTab)}
        variant="secondary"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Flujo de caja" className="rounded-lg bg-default-50/50 p-1">
            <Tabs.Tab id="cash-flow">
              Resumen
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="movements">
              Movimientos
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="categories">
              Categorías
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="cash-flow" className="space-y-3 pt-3">
          <Card>
            <div className="space-y-3 p-3">
              <div className="max-w-xs">
                <Select
                  value={selectedMonth}
                  onChange={(key) => {
                    setSelectedMonth(String(key ?? ""));
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

              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <div className="rounded-md border border-default-200 px-2.5 py-2">
                  <p className="text-tiny text-default-500">Ingresos</p>
                  {isLoading ? (
                    <Skeleton className="mt-1 h-6 w-24 rounded-md" />
                  ) : (
                    <p className="font-semibold text-success">
                      {formatCurrency(monthlySummary.totals.income)}
                    </p>
                  )}
                </div>
                <div className="rounded-md border border-default-200 px-2.5 py-2">
                  <p className="text-tiny text-default-500">Egresos</p>
                  {isLoading ? (
                    <Skeleton className="mt-1 h-6 w-24 rounded-md" />
                  ) : (
                    <p className="font-semibold text-danger">
                      {formatCurrency(monthlySummary.totals.expense)}
                    </p>
                  )}
                </div>
                <div className="rounded-md border border-default-200 px-2.5 py-2">
                  <p className="text-tiny text-default-500">Neto</p>
                  {isLoading ? (
                    <Skeleton className="mt-1 h-6 w-24 rounded-md" />
                  ) : (
                    <p
                      className={`font-semibold ${monthlySummary.totals.net >= 0 ? "text-success" : "text-danger"}`}
                    >
                      {formatCurrency(monthlySummary.totals.net)}
                    </p>
                  )}
                </div>
                <div className="rounded-md border border-default-200 px-2.5 py-2">
                  <p className="text-tiny text-default-500">Movimientos</p>
                  {isLoading ? (
                    <Skeleton className="mt-1 h-6 w-16 rounded-md" />
                  ) : (
                    <p className="font-semibold">{monthlySummary.totals.count}</p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-3 p-3">
              <p className="text-sm font-medium">Distribución por categoría</p>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                <div className="rounded-md border border-default-200 p-3">
                  <h4 className="mb-2 text-sm font-medium">Ingresos por categoría</h4>
                  {isLoading ? (
                    <Skeleton className="h-[320px] w-full rounded-md" />
                  ) : incomePieData.length === 0 ? (
                    <p className="text-sm text-default-500">
                      No hay ingresos para el mes seleccionado.
                    </p>
                  ) : (
                    <div className="cashflow-recharts h-[320px]">
                      <ResponsiveContainer height="100%" width="100%">
                        <PieChart>
                          <Pie
                            data={incomePieData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={70}
                            outerRadius={105}
                            paddingAngle={2}
                          >
                            {incomePieData.map((entry) => (
                              <Cell key={`income-pie-${entry.name}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number | undefined) =>
                              formatCurrency(Number(value ?? 0))
                            }
                            wrapperClassName="cashflow-recharts-tooltip"
                            contentStyle={{
                              backgroundColor: "hsl(var(--b1))",
                              border: "1px solid hsl(var(--bc) / 0.2)",
                              borderRadius: "12px",
                            }}
                          />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-default-200 p-3">
                  <h4 className="mb-2 text-sm font-medium">Egresos por categoría</h4>
                  {isLoading ? (
                    <Skeleton className="h-[320px] w-full rounded-md" />
                  ) : expensePieData.length === 0 ? (
                    <p className="text-sm text-default-500">
                      No hay egresos para el mes seleccionado.
                    </p>
                  ) : (
                    <div className="cashflow-recharts h-[320px]">
                      <ResponsiveContainer height="100%" width="100%">
                        <PieChart>
                          <Pie
                            data={expensePieData}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={70}
                            outerRadius={105}
                            paddingAngle={2}
                          >
                            {expensePieData.map((entry) => (
                              <Cell key={`expense-pie-${entry.name}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number | undefined) =>
                              formatCurrency(Number(value ?? 0))
                            }
                            wrapperClassName="cashflow-recharts-tooltip"
                            contentStyle={{
                              backgroundColor: "hsl(var(--b1))",
                              border: "1px solid hsl(var(--bc) / 0.2)",
                              borderRadius: "12px",
                            }}
                          />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel id="movements" className="space-y-3 pt-3">
          <Card>
            <div className="border-b border-default-200 p-3">
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-10">
                <div className="lg:col-span-2">
                  <Select
                    value={selectedMonth}
                    onChange={(key) => {
                      setSelectedMonth(String(key ?? ""));
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

                <div className="lg:col-span-4">
                  <Label className="mb-1 block">Categorías (multi)</Label>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button className="h-10 w-full justify-start text-left" variant="outline">
                        {selectedCategoryLabel}
                      </Button>
                    </DropdownTrigger>
                    <DropdownPopover>
                      <ListBox
                        className="max-h-60 w-[320px] overflow-auto"
                        selectedKeys={new Set(selectedCategoryFilters)}
                        selectionMode="multiple"
                        onSelectionChange={handleCategoryFilterSelection}
                      >
                        {categoryFilterOptions.map((option) => (
                          <ListBox.Item
                            id={option.value}
                            key={option.value}
                            textValue={option.label}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: option.color }}
                              />
                              <span>{option.label}</span>
                            </div>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </DropdownPopover>
                  </Dropdown>
                </div>

                <div className="lg:col-span-2">
                  <Select
                    value={columnFilters.type}
                    onChange={(key) =>
                      updateColumnFilter("type", String(key ?? "ALL") as CashFlowTypeFilter)
                    }
                  >
                    <Label>Tipo</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="ALL" textValue="Todos">
                          Todos
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="INCOME" textValue="Ingreso">
                          Ingreso
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="EXPENSE" textValue="Egreso">
                          Egreso
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                <div className="flex items-end justify-end lg:col-span-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-default-500 hover:text-foreground"
                    onClick={() => {
                      setSelectedCategoryFilters([]);
                      setColumnFilters(DEFAULT_COLUMN_FILTERS);
                      setPage(1);
                    }}
                  >
                    Limpiar
                  </Button>
                </div>

                <SearchField
                  aria-label="Buscar en descripción"
                  className="lg:col-span-2"
                  variant="secondary"
                  value={columnFilters.description}
                  onChange={(value) => updateColumnFilter("description", value)}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Descripción" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>

                <SearchField
                  aria-label="Buscar en desde"
                  className="lg:col-span-2"
                  variant="secondary"
                  value={columnFilters.fromCounterpart}
                  onChange={(value) => updateColumnFilter("fromCounterpart", value)}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Desde" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>

                <SearchField
                  aria-label="Buscar en hacia"
                  className="lg:col-span-2"
                  variant="secondary"
                  value={columnFilters.toCounterpart}
                  onChange={(value) => updateColumnFilter("toCounterpart", value)}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Hacia" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>

                <SearchField
                  aria-label="Buscar por monto"
                  className="lg:col-span-2"
                  variant="secondary"
                  value={columnFilters.amount}
                  onChange={(value) => updateColumnFilter("amount", value)}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Monto" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>

                <SearchField
                  aria-label="Buscar en comentario"
                  className="lg:col-span-2"
                  variant="secondary"
                  value={columnFilters.comment}
                  onChange={(value) => updateColumnFilter("comment", value)}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Comentario" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </div>

              {hasActiveFilters && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {selectedCategoryFilters.map((categoryKey) => (
                    <Button
                      key={categoryKey}
                      className="h-7 rounded-full px-3"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedCategoryFilters((prev) =>
                          prev.filter((key) => key !== categoryKey),
                        );
                        setPage(1);
                      }}
                    >
                      {selectedCategoryMap.get(categoryKey) ?? categoryKey}
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  ))}

                  {columnFilters.type !== "ALL" && (
                    <Button
                      className="h-7 rounded-full px-3"
                      size="sm"
                      variant="outline"
                      onClick={() => updateColumnFilter("type", "ALL")}
                    >
                      {columnFilters.type === "INCOME" ? "Ingreso" : "Egreso"}
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {columnFilters.description.trim().length > 0 && (
                    <Button
                      className="h-7 rounded-full px-3"
                      size="sm"
                      variant="outline"
                      onClick={() => updateColumnFilter("description", "")}
                    >
                      Descripción: {columnFilters.description}
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {columnFilters.fromCounterpart.trim().length > 0 && (
                    <Button
                      className="h-7 rounded-full px-3"
                      size="sm"
                      variant="outline"
                      onClick={() => updateColumnFilter("fromCounterpart", "")}
                    >
                      Desde: {columnFilters.fromCounterpart}
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {columnFilters.toCounterpart.trim().length > 0 && (
                    <Button
                      className="h-7 rounded-full px-3"
                      size="sm"
                      variant="outline"
                      onClick={() => updateColumnFilter("toCounterpart", "")}
                    >
                      Hacia: {columnFilters.toCounterpart}
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {columnFilters.amount.trim().length > 0 && (
                    <Button
                      className="h-7 rounded-full px-3"
                      size="sm"
                      variant="outline"
                      onClick={() => updateColumnFilter("amount", "")}
                    >
                      Monto: {columnFilters.amount}
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {columnFilters.comment.trim().length > 0 && (
                    <Button
                      className="h-7 rounded-full px-3"
                      size="sm"
                      variant="outline"
                      onClick={() => updateColumnFilter("comment", "")}
                    >
                      Comentario: {columnFilters.comment}
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="p-0">
              <CashFlowTable
                data={paginatedTransactions}
                categories={categories}
                total={totalFiltered}
                isLoading={isLoading}
                page={safePage}
                pageSize={TABLE_PAGE_SIZE}
                onPageChange={(nextPage) => setPage(Math.max(1, nextPage))}
                onEdit={handleEdit}
                onCategoryChange={handleCategoryChange}
                updatingCategoryIds={updatingCategoryIds}
              />
            </div>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel id="categories" className="space-y-3 pt-3">
          <Card>
            <div className="p-3">
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
                  value={newCategoryType}
                  onChange={(key) =>
                    setNewCategoryType(String(key ?? "EXPENSE") as "EXPENSE" | "INCOME")
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
                      <ListBox.Item id="EXPENSE" textValue="Egreso">
                        Egreso
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>

                <CategoryColorPicker
                  label="Color"
                  value={newCategoryColor}
                  onChange={setNewCategoryColor}
                />

                <div className="md:col-span-4">
                  <Button type="submit" isPending={createCategoryMutation.isPending}>
                    {({ isPending }) => (isPending ? "Creando..." : "Crear categoría")}
                  </Button>
                </div>
              </form>
            </div>
          </Card>

          <Card>
            <div className="p-3">
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
                            value={editingCategoryType}
                            onChange={(key) =>
                              setEditingCategoryType(
                                String(key ?? "EXPENSE") as "EXPENSE" | "INCOME",
                              )
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
                                <ListBox.Item id="EXPENSE" textValue="Egreso">
                                  Egreso
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              </ListBox>
                            </Select.Popover>
                          </Select>
                          <CategoryColorPicker
                            label="Color"
                            value={editingCategoryColor}
                            onChange={setEditingCategoryColor}
                          />
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
                              {category.type === "INCOME" ? "Ingreso" : "Egreso"}
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

          <Card>
            <div className="space-y-3 p-3">
              <h3 className="text-sm font-semibold">Reglas automáticas por contraparte</h3>
              <form
                className="grid grid-cols-1 gap-3 md:grid-cols-8"
                onSubmit={handleCreateAutoCategoryRule}
              >
                <TextField className="md:col-span-2">
                  <Label>Nombre regla</Label>
                  <Input
                    placeholder="Ej: Paula Flores MP Egreso"
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                  />
                </TextField>
                <Select
                  className="md:col-span-2"
                  value={newRuleCounterpartId == null ? null : String(newRuleCounterpartId)}
                  onChange={(key) => {
                    const value = key == null || String(key) === "__none__" ? null : Number(key);
                    setNewRuleCounterpartId(value);
                  }}
                >
                  <Label>Contraparte</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="__none__" textValue="Sin filtro">
                        Sin filtro (cualquier contraparte)
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      {counterpartOptions.map((counterpart) => (
                        <ListBox.Item
                          id={String(counterpart.value)}
                          key={counterpart.value}
                          textValue={counterpart.label}
                        >
                          {counterpart.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <Select
                  value={newRuleType}
                  onChange={(key) =>
                    setNewRuleType(String(key ?? "EXPENSE") as "EXPENSE" | "INCOME")
                  }
                >
                  <Label>Tipo</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="EXPENSE" textValue="Egreso">
                        Egreso
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="INCOME" textValue="Ingreso">
                        Ingreso
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
                <Select
                  className="md:col-span-2"
                  value={newRuleCategoryId == null ? null : String(newRuleCategoryId)}
                  onChange={(key) => {
                    const value = key == null ? null : Number(key);
                    setNewRuleCategoryId(value);
                  }}
                >
                  <Label>Categoría</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {categoryOptionsByType[newRuleType].map((category) => (
                        <ListBox.Item
                          id={String(category.id)}
                          key={category.id}
                          textValue={category.name}
                        >
                          {category.name}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <TextField>
                  <Label>Prioridad</Label>
                  <Input
                    inputMode="numeric"
                    value={newRulePriority}
                    onChange={(e) => setNewRulePriority(e.target.value.replace(/[^\d-]/g, ""))}
                  />
                </TextField>
                <TextField>
                  <Label>Monto mínimo</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="0"
                    value={newRuleMinAmount}
                    onChange={(e) => setNewRuleMinAmount(e.target.value.replace(/[^0-9.-]/g, ""))}
                  />
                </TextField>
                <TextField>
                  <Label>Monto máximo</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="200000"
                    value={newRuleMaxAmount}
                    onChange={(e) => setNewRuleMaxAmount(e.target.value.replace(/[^0-9.-]/g, ""))}
                  />
                </TextField>
                <TextField className="md:col-span-2">
                  <Label>Comentario contiene</Label>
                  <Input
                    placeholder="Ref: Venta presencial"
                    value={newRuleCommentContains}
                    onChange={(e) => setNewRuleCommentContains(e.target.value)}
                  />
                </TextField>
                <TextField className="md:col-span-2">
                  <Label>Descripción contiene</Label>
                  <Input
                    placeholder="Opcional"
                    value={newRuleDescriptionContains}
                    onChange={(e) => setNewRuleDescriptionContains(e.target.value)}
                  />
                </TextField>
                <div className="flex items-end md:col-span-8">
                  <Button type="submit" isPending={createAutoCategoryRuleMutation.isPending}>
                    Crear regla
                  </Button>
                </div>
              </form>

              {autoCategoryRules.length === 0 ? (
                <p className="text-default-500 text-sm">No hay reglas automáticas configuradas.</p>
              ) : (
                <div className="space-y-2">
                  {autoCategoryRules.map((rule) => (
                    <div key={rule.id} className="rounded-md border border-default-200 px-3 py-2">
                      {editingRuleId === rule.id ? (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-8 md:items-end">
                          <TextField className="md:col-span-2">
                            <Label>Nombre regla</Label>
                            <Input
                              value={editingRuleName}
                              onChange={(e) => setEditingRuleName(e.target.value)}
                            />
                          </TextField>
                          <Select
                            value={
                              editingRuleCounterpartId == null
                                ? null
                                : String(editingRuleCounterpartId)
                            }
                            onChange={(key) => {
                              const value =
                                key == null || String(key) === "__none__" ? null : Number(key);
                              setEditingRuleCounterpartId(value);
                            }}
                          >
                            <Label>Contraparte</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                <ListBox.Item id="__none__" textValue="Sin filtro">
                                  Sin filtro (cualquier contraparte)
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                                {counterpartOptions.map((counterpart) => (
                                  <ListBox.Item
                                    id={String(counterpart.value)}
                                    key={counterpart.value}
                                    textValue={counterpart.label}
                                  >
                                    {counterpart.label}
                                    <ListBox.ItemIndicator />
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                          </Select>
                          <Select
                            value={editingRuleType}
                            onChange={(key) =>
                              setEditingRuleType(String(key ?? "EXPENSE") as "EXPENSE" | "INCOME")
                            }
                          >
                            <Label>Tipo</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                <ListBox.Item id="EXPENSE" textValue="Egreso">
                                  Egreso
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                                <ListBox.Item id="INCOME" textValue="Ingreso">
                                  Ingreso
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              </ListBox>
                            </Select.Popover>
                          </Select>
                          <Select
                            value={
                              editingRuleCategoryId == null ? null : String(editingRuleCategoryId)
                            }
                            onChange={(key) => {
                              const value = key == null ? null : Number(key);
                              setEditingRuleCategoryId(value);
                            }}
                          >
                            <Label>Categoría</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                {categoryOptionsByType[editingRuleType].map((category) => (
                                  <ListBox.Item
                                    id={String(category.id)}
                                    key={category.id}
                                    textValue={category.name}
                                  >
                                    {category.name}
                                    <ListBox.ItemIndicator />
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                          </Select>
                          <TextField>
                            <Label>Prioridad</Label>
                            <Input
                              inputMode="numeric"
                              value={editingRulePriority}
                              onChange={(e) =>
                                setEditingRulePriority(e.target.value.replace(/[^\d-]/g, ""))
                              }
                            />
                          </TextField>
                          <TextField>
                            <Label>Monto mínimo</Label>
                            <Input
                              inputMode="decimal"
                              value={editingRuleMinAmount}
                              onChange={(e) =>
                                setEditingRuleMinAmount(e.target.value.replace(/[^0-9.-]/g, ""))
                              }
                            />
                          </TextField>
                          <TextField>
                            <Label>Monto máximo</Label>
                            <Input
                              inputMode="decimal"
                              value={editingRuleMaxAmount}
                              onChange={(e) =>
                                setEditingRuleMaxAmount(e.target.value.replace(/[^0-9.-]/g, ""))
                              }
                            />
                          </TextField>
                          <TextField className="md:col-span-2">
                            <Label>Comentario contiene</Label>
                            <Input
                              value={editingRuleCommentContains}
                              onChange={(e) => setEditingRuleCommentContains(e.target.value)}
                            />
                          </TextField>
                          <TextField className="md:col-span-2">
                            <Label>Descripción contiene</Label>
                            <Input
                              value={editingRuleDescriptionContains}
                              onChange={(e) => setEditingRuleDescriptionContains(e.target.value)}
                            />
                          </TextField>
                          <Select
                            value={editingRuleIsActive ? "ACTIVE" : "INACTIVE"}
                            onChange={(key) => setEditingRuleIsActive(String(key) === "ACTIVE")}
                          >
                            <Label>Estado</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                <ListBox.Item id="ACTIVE" textValue="Activa">
                                  Activa
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                                <ListBox.Item id="INACTIVE" textValue="Inactiva">
                                  Inactiva
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              </ListBox>
                            </Select.Popover>
                          </Select>
                          <div className="flex gap-2 md:col-span-8 md:justify-end">
                            <Button size="sm" variant="secondary" onPress={handleCancelEditRule}>
                              Cancelar
                            </Button>
                            <Button
                              size="sm"
                              onPress={() => handleSaveEditRule(rule.id)}
                              isPending={updateAutoCategoryRuleMutation.isPending}
                            >
                              Guardar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{rule.name}</p>
                            <p className="text-tiny text-default-500">
                              {rule.counterpart
                                ? `${rule.counterpart.bankAccountHolder} (${rule.counterpart.identificationNumber})`
                                : "Sin filtro de contraparte"}
                            </p>
                            <p className="text-tiny text-default-500">
                              {rule.type === "INCOME" ? "Ingreso" : "Egreso"} | {rule.category.name}{" "}
                              | prioridad {rule.priority} | {rule.isActive ? "Activa" : "Inactiva"}
                            </p>
                            <p className="text-tiny text-default-500">
                              {rule.minAmount != null ? `min ${rule.minAmount}` : "min -"} |{" "}
                              {rule.maxAmount != null ? `max ${rule.maxAmount}` : "max -"} |{" "}
                              comentario: {rule.commentContains || "-"} | descripción:{" "}
                              {rule.descriptionContains || "-"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onPress={() => handleStartEditRule(rule)}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-danger"
                              isPending={deleteAutoCategoryRuleMutation.isPending}
                              onPress={() => handleDeleteRule(rule)}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </div>
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
