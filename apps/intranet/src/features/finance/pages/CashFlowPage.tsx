import type { FinancialTransaction, TransactionCategory } from "@finanzas/db";
import {
  Button,
  Card,
  Chip,
  ColorField,
  ColorPicker,
  ColorSwatch,
  ColorSwatchPicker,
  Description,
  Dropdown,
  Header,
  Input,
  Label,
  ListBox,
  Modal,
  parseColor,
  SearchField,
  Select,
  type Selection,
  Skeleton,
  Switch,
  Tabs,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { X } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { z } from "zod";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";
import { ApiError, apiClient } from "@/lib/api-client";
import { toast } from "@/lib/toast-interceptor";
import type { TransactionWithRelations } from "../components/CashFlowColumns";
import { isNonAccountableCategory } from "../utils/non-accountable-category";

const CashFlowTable = lazy(() =>
  import("../components/CashFlowTable").then((module) => ({
    default: module.CashFlowTable,
  })),
);

const TransactionForm = lazy(() =>
  import("../components/TransactionForm").then((module) => ({
    default: module.TransactionForm,
  })),
);

// Hooks
interface TransactionQueryParams {
  effectivePeriod?: string;
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

const AvailableMonthsResponseSchema = z.object({
  data: z.array(z.string()),
  status: z.literal("ok"),
});

const TransactionCategorySchema = z
  .object({
    color: z.string().nullable().optional(),
    id: z.number(),
    icon: z.string().nullable().optional(),
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

const CompensationProfileSchema = z.object({
  category: TransactionCategorySchema,
  categoryId: z.number(),
  counterpart: CounterpartSchema.nullable().optional(),
  counterpartId: z.number().nullable().optional(),
  id: z.number(),
  isActive: z.boolean(),
  name: z.string(),
  timezone: z.string(),
});

const CompensationProfilesResponseSchema = z.object({
  data: z.array(CompensationProfileSchema),
  status: z.literal("ok"),
});

const CompensationLedgerEntrySchema = z.object({
  allocatedAmount: z.number(),
  budgetAmount: z.number(),
  isLocked: z.boolean(),
  period: z.string(),
  variance: z.number(),
});

const CompensationLedgerResponseSchema = z.object({
  data: z.array(CompensationLedgerEntrySchema),
  status: z.literal("ok"),
});

const ReallocationResponseSchema = z.object({
  data: z
    .object({
      allocationType: z.string(),
      amount: z.number(),
      id: z.number(),
      period: z.string(),
      profileId: z.number(),
      transactionId: z.number(),
    })
    .passthrough(),
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

const SyncUncategorizedByPatternsResponseSchema = z.object({
  data: z.object({
    updated: z.number(),
  }),
  status: z.literal("ok"),
});
type SyncUncategorizedByPatternsResponse = z.infer<
  typeof SyncUncategorizedByPatternsResponseSchema
>;

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
          effectivePeriod: params.effectivePeriod,
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

type CompensationProfileOption = z.infer<typeof CompensationProfileSchema>;

function useCompensationProfiles() {
  return useQuery<CompensationProfileOption[]>({
    queryKey: ["CompensationProfile"],
    queryFn: async () => {
      const payload = await apiClient.get<{ data: CompensationProfileOption[] }>(
        "/api/finance/compensation-profiles",
        {
          responseSchema: CompensationProfilesResponseSchema,
        },
      );
      return payload.data;
    },
  });
}

function useCompensationLedger(profileId: null | number, period: string) {
  const fromPeriod = period;
  const toPeriod = period;
  return useQuery<z.infer<typeof CompensationLedgerEntrySchema>[]>({
    enabled: profileId != null,
    queryKey: ["CompensationLedger", profileId, fromPeriod, toPeriod],
    queryFn: async () => {
      const payload = await apiClient.get<{
        data: z.infer<typeof CompensationLedgerEntrySchema>[];
      }>(`/api/finance/compensation-profiles/${profileId}/ledger`, {
        query: { fromPeriod, toPeriod },
        responseSchema: CompensationLedgerResponseSchema,
      });
      return payload.data;
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

function useAvailableFinancialMonths() {
  return useQuery<string[]>({
    queryKey: ["FinancialTransaction", "available-months"],
    queryFn: async () => {
      const payload = await apiClient.get<{ data: string[] }>(
        "/api/finance/transactions/available-months",
        {
          responseSchema: AvailableMonthsResponseSchema,
        },
      );
      return payload.data;
    },
    staleTime: 5 * 60 * 1000,
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
const PIE_MAX_SEGMENTS = 8;

type CashFlowTypeFilter = "ALL" | "EXPENSE" | "INCOME";

type CashFlowColumnFilters = {
  amount: string;
  comment: string;
  fromCounterpart: string;
  toCounterpart: string;
  type: CashFlowTypeFilter;
};

const DEFAULT_COLUMN_FILTERS: CashFlowColumnFilters = {
  amount: "",
  comment: "",
  fromCounterpart: "",
  toCounterpart: "",
  type: "ALL",
};

const normalizeText = (value: null | string | undefined) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
const MONTH_VALUE_REGEX = /^\d{4}-\d{2}$/;

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

type PieTooltipPayloadEntry = {
  name?: string;
  value?: number;
};

function CashflowPieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: PieTooltipPayloadEntry[];
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const item = payload[0];
  return (
    <div className="rounded-md border border-default-300 bg-default-100 px-2.5 py-1.5 text-sm text-foreground shadow-md">
      <span className="font-medium">{item?.name ?? "Categoría"}</span>
      <span> : {formatCurrency(Number(item?.value ?? 0))}</span>
    </div>
  );
}

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
  const rows = items
    .filter((item) => item.type === type)
    .map((item, index) => ({
      color: item.categoryColor ?? PIE_COLORS[index % PIE_COLORS.length] ?? "#64748B",
      name: item.categoryName,
      value: Math.abs(item.total),
    }))
    .filter((item) => item.value > 0);

  if (rows.length <= PIE_MAX_SEGMENTS) {
    return rows;
  }

  const sortedRows = [...rows].sort((a, b) => b.value - a.value);
  const mainRows = sortedRows.slice(0, PIE_MAX_SEGMENTS - 1);
  const remainingRows = sortedRows.slice(PIE_MAX_SEGMENTS - 1);
  const othersTotal = remainingRows.reduce((acc, row) => acc + row.value, 0);

  return [
    ...mainRows,
    {
      color: "#94A3B8",
      name: "Otros",
      value: othersTotal,
    },
  ];
}

function CategoryColorPicker({
  className,
  label,
  onChange,
  value,
}: {
  className?: string;
  label: string;
  onChange: (hex: string) => void;
  value: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`.trim()}>
      <Label>{label}</Label>
      <ColorPicker value={parseColor(value)} onChange={(color) => onChange(color.toString("hex"))}>
        <ColorPicker.Trigger className="flex h-10 w-full items-center gap-2 rounded-xl border border-default-300/70 bg-default-100/35 px-3">
          <ColorSwatch size="sm" />
          <span className="text-tiny text-default-500 uppercase">{value}</span>
        </ColorPicker.Trigger>
        <ColorPicker.Popover className="gap-2 p-2">
          <ColorSwatchPicker className="justify-center" size="xs">
            {CATEGORY_COLOR_PRESETS.map((color) => (
              <ColorSwatchPicker.Item key={color} color={color}>
                <ColorSwatchPicker.Swatch />
                <ColorSwatchPicker.Indicator />
              </ColorSwatchPicker.Item>
            ))}
          </ColorSwatchPicker>
          <ColorField>
            <Label>Color</Label>
            <ColorField.Input />
          </ColorField>
        </ColorPicker.Popover>
      </ColorPicker>
    </div>
  );
}

export function CashFlowPage() {
  const [page, setPage] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));
  const [activeTab, setActiveTab] = useState<CashFlowTab>("cash-flow");
  const { isTabMounted, markTabAsMounted } = useLazyTabs<CashFlowTab>("cash-flow");
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<string[]>([]);
  const [categoryFilterSearch, setCategoryFilterSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<CashFlowColumnFilters>(DEFAULT_COLUMN_FILTERS);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinancialTransaction | null>(null);
  const [updatingCategoryIds, setUpdatingCategoryIds] = useState<Set<number>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [newCategoryColor, setNewCategoryColor] = useState("#64748b");
  const [newCategoryIsNonAccountable, setNewCategoryIsNonAccountable] = useState(false);
  const [activeCategorySection, setActiveCategorySection] = useState<
    "catalog" | "compensation" | "rules"
  >("catalog");
  const [editingCategoryId, setEditingCategoryId] = useState<null | number>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategoryType, setEditingCategoryType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [editingCategoryColor, setEditingCategoryColor] = useState("#64748b");
  const [editingCategoryIsNonAccountable, setEditingCategoryIsNonAccountable] = useState(false);
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
  const [newCompensationName, setNewCompensationName] = useState("");
  const [newCompensationCategoryId, setNewCompensationCategoryId] = useState<null | number>(null);
  const [newCompensationCounterpartId, setNewCompensationCounterpartId] = useState<null | number>(
    null,
  );
  const [newCompensationIsActive, setNewCompensationIsActive] = useState(true);
  const [selectedCompensationProfileId, setSelectedCompensationProfileId] = useState<null | number>(
    null,
  );
  const [budgetAmountInput, setBudgetAmountInput] = useState("");
  const [isReallocateOpen, setIsReallocateOpen] = useState(false);
  const [reallocateTx, setReallocateTx] = useState<null | TransactionWithRelations>(null);
  const [reallocateProfileId, setReallocateProfileId] = useState<null | number>(null);
  const [reallocateFromPeriod, setReallocateFromPeriod] = useState(dayjs().format("YYYY-MM"));
  const [reallocateTargetPeriod, setReallocateTargetPeriod] = useState(dayjs().format("YYYY-MM"));
  const [reallocateAmount, setReallocateAmount] = useState<null | number>(null);
  const [showNonAccountableMovements, setShowNonAccountableMovements] = useState(false);
  const [showOnlyUncategorizedMovements, setShowOnlyUncategorizedMovements] = useState(false);
  const { data: availableMonths = [] } = useAvailableFinancialMonths();

  const monthOptions = useMemo(() => {
    const uniqueMonths = Array.from(
      new Set(availableMonths.filter((value) => MONTH_VALUE_REGEX.test(value))),
    ).sort((a, b) => b.localeCompare(a));

    if (uniqueMonths.length === 0) {
      const value = dayjs().startOf("month").format("YYYY-MM");
      return [{ label: formatMonthLabel(value), value }];
    }

    return uniqueMonths.map((value) => ({
      label: formatMonthLabel(value),
      value,
    }));
  }, [availableMonths]);

  const monthOptionsByYear = useMemo(() => {
    const grouped = new Map<string, typeof monthOptions>();
    for (const option of monthOptions) {
      const year = option.value.slice(0, 4);
      const options = grouped.get(year) ?? [];
      options.push(option);
      grouped.set(year, options);
    }
    return Array.from(grouped.entries()).map(([year, options]) => ({
      options,
      year,
    }));
  }, [monthOptions]);

  useEffect(() => {
    const firstMonthOption = monthOptions[0];
    if (!firstMonthOption) return;
    if (monthOptions.some((option) => option.value === selectedMonth)) return;
    setSelectedMonth(firstMonthOption.value);
    setPage(1);
  }, [monthOptions, selectedMonth]);

  const { data, isLoading } = useFinancialTransactions({
    effectivePeriod: selectedMonth,
    page: 1,
    pageSize: 2500,
  });
  const { data: categories = [] } = useTransactionCategories();
  const { data: counterparts = [] } = useCounterparts();
  const { data: compensationProfiles = [] } = useCompensationProfiles();
  const { data: selectedCompensationLedger = [] } = useCompensationLedger(
    selectedCompensationProfileId,
    selectedMonth,
  );
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
  const visibleCategoryFilterOptions = useMemo(() => {
    const search = normalizeText(categoryFilterSearch);
    if (!search) return categoryFilterOptions;
    return categoryFilterOptions.filter((option) => normalizeText(option.label).includes(search));
  }, [categoryFilterOptions, categoryFilterSearch]);

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
  const activeCompensationProfiles = useMemo(
    () => compensationProfiles.filter((profile) => profile.isActive),
    [compensationProfiles],
  );
  const selectedCompensationEntry = selectedCompensationLedger[0];

  useEffect(() => {
    if (activeCompensationProfiles.length === 0) {
      setSelectedCompensationProfileId(null);
      return;
    }
    if (
      selectedCompensationProfileId != null &&
      activeCompensationProfiles.some((profile) => profile.id === selectedCompensationProfileId)
    ) {
      return;
    }
    setSelectedCompensationProfileId(activeCompensationProfiles[0]?.id ?? null);
  }, [activeCompensationProfiles, selectedCompensationProfileId]);

  const hasActiveFilters =
    selectedCategoryFilters.length > 0 ||
    columnFilters.type !== "ALL" ||
    columnFilters.fromCounterpart.trim().length > 0 ||
    columnFilters.toCounterpart.trim().length > 0 ||
    columnFilters.amount.trim().length > 0 ||
    columnFilters.comment.trim().length > 0 ||
    showNonAccountableMovements ||
    showOnlyUncategorizedMovements;
  const visibilityFiltersCount =
    Number(showNonAccountableMovements) + Number(showOnlyUncategorizedMovements);

  const monthTransactions = data?.data ?? [];
  const reallocationProfileOptions = useMemo(() => {
    if (!reallocateTx) return activeCompensationProfiles;
    return activeCompensationProfiles.filter((profile) => {
      if (reallocateTx.categoryId == null || profile.categoryId !== reallocateTx.categoryId) {
        return false;
      }
      if (profile.counterpartId != null && profile.counterpartId !== reallocateTx.counterpartId) {
        return false;
      }
      return true;
    });
  }, [activeCompensationProfiles, reallocateTx]);
  const targetPeriodOptions = useMemo(() => {
    const nextPeriod = dayjs(`${reallocateFromPeriod}-01`).add(1, "month").format("YYYY-MM");
    const filtered = monthOptions.filter((option) => option.value >= nextPeriod);
    if (filtered.some((option) => option.value === nextPeriod)) {
      return filtered;
    }
    return [{ label: formatMonthLabel(nextPeriod), value: nextPeriod }, ...filtered].sort((a, b) =>
      b.value.localeCompare(a.value),
    );
  }, [monthOptions, reallocateFromPeriod]);
  const nonAccountableCategoryIds = useMemo(
    () =>
      new Set(
        categories
          .filter((category) => isNonAccountableCategory(category))
          .map((category) => category.id),
      ),
    [categories],
  );

  const filteredTransactions = useMemo(() => {
    const fromCounterpartFilter = normalizeText(columnFilters.fromCounterpart);
    const toCounterpartFilter = normalizeText(columnFilters.toCounterpart);
    const commentFilter = normalizeText(columnFilters.comment);
    const amountFilter = columnFilters.amount.replace(/[^\d-]/g, "").trim();

    return monthTransactions.filter((tx) => {
      if (
        !showNonAccountableMovements &&
        tx.categoryId != null &&
        nonAccountableCategoryIds.has(tx.categoryId)
      ) {
        return false;
      }

      if (showOnlyUncategorizedMovements && tx.categoryId != null) {
        return false;
      }

      if (columnFilters.type !== "ALL" && tx.type !== columnFilters.type) {
        return false;
      }

      if (selectedCategoryFilters.length > 0) {
        const txCategoryKey = tx.categoryId == null ? "__none__" : String(tx.categoryId);
        if (!selectedCategoryFilters.includes(txCategoryKey)) {
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
  }, [
    columnFilters,
    monthTransactions,
    nonAccountableCategoryIds,
    selectedCategoryFilters,
    showOnlyUncategorizedMovements,
    showNonAccountableMovements,
  ]);

  const accountableMonthTransactions = useMemo(
    () =>
      monthTransactions.filter(
        (tx) => tx.categoryId == null || !nonAccountableCategoryIds.has(tx.categoryId),
      ),
    [monthTransactions, nonAccountableCategoryIds],
  );
  const monthlySummary = useMemo(
    () => buildSummary(accountableMonthTransactions),
    [accountableMonthTransactions],
  );
  const incomeCategorySummary = useMemo(
    () =>
      monthlySummary.byCategory
        .filter((item) => item.type === "INCOME")
        .sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
    [monthlySummary.byCategory],
  );
  const expenseCategorySummary = useMemo(
    () =>
      monthlySummary.byCategory
        .filter((item) => item.type === "EXPENSE")
        .sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
    [monthlySummary.byCategory],
  );
  const incomePieData = useMemo(
    () => buildPieCategoryData(monthlySummary.byCategory, "INCOME"),
    [monthlySummary.byCategory],
  );
  const expensePieData = useMemo(
    () => buildPieCategoryData(monthlySummary.byCategory, "EXPENSE"),
    [monthlySummary.byCategory],
  );
  const incomePieTotal = useMemo(
    () => incomePieData.reduce((acc, item) => acc + item.value, 0),
    [incomePieData],
  );
  const expensePieTotal = useMemo(
    () => expensePieData.reduce((acc, item) => acc + item.value, 0),
    [expensePieData],
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
    mutationFn: async (payload: {
      color?: string;
      isNonAccountable?: boolean;
      name: string;
      type: "EXPENSE" | "INCOME";
    }) =>
      apiClient.post("/api/finance/categories", payload, {
        responseSchema: CreateTransactionCategoryResponseSchema,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["TransactionCategory"] });
      setNewCategoryName("");
      setNewCategoryType("EXPENSE");
      setNewCategoryColor("#64748b");
      setNewCategoryIsNonAccountable(false);
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
      isNonAccountable?: boolean;
      name: string;
      type: "EXPENSE" | "INCOME";
    }) =>
      apiClient.put(
        `/api/finance/categories/${payload.id}`,
        {
          color: payload.color,
          isNonAccountable: payload.isNonAccountable,
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

  const createCompensationProfileMutation = useMutation({
    mutationFn: async (payload: {
      categoryId: number;
      counterpartId?: null | number;
      isActive?: boolean;
      name: string;
    }) =>
      apiClient.post("/api/finance/compensation-profiles", payload, {
        responseSchema: z.object({ data: CompensationProfileSchema, status: z.literal("ok") }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["CompensationProfile"] });
      setNewCompensationName("");
      setNewCompensationCategoryId(null);
      setNewCompensationCounterpartId(null);
      setNewCompensationIsActive(true);
      toast.success("Perfil de compensación creado");
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Error al crear perfil";
      toast.error(message);
    },
  });

  const upsertCompensationBudgetMutation = useMutation({
    mutationFn: async (payload: { baseAmount: number; period: string; profileId: number }) =>
      apiClient.put(
        `/api/finance/compensation-profiles/${payload.profileId}/budget`,
        {
          baseAmount: payload.baseAmount,
          period: payload.period,
        },
        {
          responseSchema: z.object({
            data: z.unknown(),
            status: z.literal("ok"),
          }),
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["CompensationLedger"] });
      toast.success("Presupuesto de período actualizado");
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Error al guardar presupuesto";
      toast.error(message);
    },
  });

  const reallocateTransactionMutation = useMutation({
    mutationFn: async (payload: {
      amount: number;
      fromPeriod: string;
      profileId: number;
      targetPeriod: string;
      transactionId: number;
    }) =>
      apiClient.post(
        `/api/finance/transactions/${payload.transactionId}/reallocate`,
        {
          amount: payload.amount,
          fromPeriod: payload.fromPeriod,
          profileId: payload.profileId,
          targetPeriod: payload.targetPeriod,
        },
        {
          responseSchema: ReallocationResponseSchema,
        },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["FinancialTransaction"] }),
        queryClient.invalidateQueries({ queryKey: ["CompensationLedger"] }),
      ]);
      toast.success("Movimiento reasignado al período destino");
      setIsReallocateOpen(false);
      setReallocateTx(null);
      setReallocateAmount(null);
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : "Error al reasignar movimiento";
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

  const syncUncategorizedByPatternsMutation = useMutation({
    mutationFn: async (): Promise<SyncUncategorizedByPatternsResponse> =>
      apiClient.post(
        "/api/finance/sync/uncategorized-patterns",
        {},
        {
          responseSchema: SyncUncategorizedByPatternsResponseSchema,
        },
      ),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["FinancialTransaction"] });
      toast.success(`Sincronización completada: ${response.data.updated} categorizados`);
    },
    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : "Error al sincronizar sin categoría";
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
      isNonAccountable: newCategoryIsNonAccountable,
      name,
      type: newCategoryType,
    });
  };

  const handleStartEditCategory = (category: TransactionCategory) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setEditingCategoryType(category.type === "INCOME" ? "INCOME" : "EXPENSE");
    setEditingCategoryColor(category.color ?? "#64748b");
    setEditingCategoryIsNonAccountable(isNonAccountableCategory(category));
  };

  const handleCancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditingCategoryName("");
    setEditingCategoryType("EXPENSE");
    setEditingCategoryColor("#64748b");
    setEditingCategoryIsNonAccountable(false);
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
      isNonAccountable: editingCategoryIsNonAccountable,
      name,
      type: editingCategoryType,
    });
  };

  const handleDeleteCategory = (category: TransactionCategory) => {
    const confirmed = window.confirm(`¿Eliminar la categoría "${category.name}"?`);
    if (!confirmed) return;
    deleteCategoryMutation.mutate(category.id);
  };

  const handleCreateCompensationProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCompensationName.trim();
    if (!name) {
      toast.error("El nombre del perfil es obligatorio");
      return;
    }
    if (newCompensationCategoryId == null) {
      toast.error("Selecciona una categoría de egreso");
      return;
    }
    createCompensationProfileMutation.mutate({
      categoryId: newCompensationCategoryId,
      counterpartId: newCompensationCounterpartId,
      isActive: newCompensationIsActive,
      name,
    });
  };

  const handleSavePeriodBudget = () => {
    if (selectedCompensationProfileId == null) {
      toast.error("Selecciona un perfil de compensación");
      return;
    }
    const parsedAmount = Number.parseFloat(budgetAmountInput.replace(/[^0-9.-]/g, ""));
    if (Number.isNaN(parsedAmount)) {
      toast.error("Ingresa un monto válido");
      return;
    }
    upsertCompensationBudgetMutation.mutate({
      baseAmount: parsedAmount,
      period: selectedMonth,
      profileId: selectedCompensationProfileId,
    });
  };

  const handleOpenReallocate = (tx: TransactionWithRelations) => {
    if (tx.categoryId == null) {
      toast.error("La transacción debe tener categoría para reasignar");
      return;
    }
    const matchingProfiles = activeCompensationProfiles.filter((profile) => {
      if (profile.categoryId !== tx.categoryId) return false;
      if (profile.counterpartId != null && profile.counterpartId !== tx.counterpartId) return false;
      return true;
    });
    if (matchingProfiles.length === 0) {
      toast.error("No hay perfil de compensación activo para esta transacción");
      return;
    }

    const fromPeriod = dayjs(tx.date).format("YYYY-MM");
    const targetPeriod = dayjs(`${fromPeriod}-01`).add(1, "month").format("YYYY-MM");
    const defaultProfile = matchingProfiles[0];
    setReallocateTx(tx);
    setReallocateProfileId(defaultProfile?.id ?? null);
    setReallocateFromPeriod(fromPeriod);
    setReallocateTargetPeriod(targetPeriod);
    setReallocateAmount(Math.abs(Number(tx.amount)));
    setIsReallocateOpen(true);
  };

  const handleSubmitReallocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reallocateTx) {
      toast.error("No hay transacción seleccionada");
      return;
    }
    if (reallocateProfileId == null) {
      toast.error("Selecciona un perfil de compensación");
      return;
    }
    if (reallocateTargetPeriod <= reallocateFromPeriod) {
      toast.error("El período destino debe ser al menos un mes posterior al origen");
      return;
    }
    if (reallocateAmount == null || !Number.isFinite(reallocateAmount) || reallocateAmount <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    reallocateTransactionMutation.mutate({
      amount: reallocateAmount,
      fromPeriod: reallocateFromPeriod,
      profileId: reallocateProfileId,
      targetPeriod: reallocateTargetPeriod,
      transactionId: reallocateTx.id,
    });
  };

  useEffect(() => {
    if (targetPeriodOptions.length === 0) return;
    if (targetPeriodOptions.some((option) => option.value === reallocateTargetPeriod)) return;
    setReallocateTargetPeriod(targetPeriodOptions[0]?.value ?? reallocateTargetPeriod);
  }, [reallocateTargetPeriod, targetPeriodOptions]);

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

  const navigateToMovementsBySummaryCategory = (item: SummaryByCategoryEntry) => {
    const categoryKey = item.categoryId == null ? "__none__" : String(item.categoryId);
    setSelectedCategoryFilters([categoryKey]);
    setColumnFilters((prev) => ({
      ...prev,
      type: item.type,
    }));
    if (item.categoryId != null && nonAccountableCategoryIds.has(item.categoryId)) {
      setShowNonAccountableMovements(true);
    }
    setPage(1);
    setActiveTab("movements");
    markTabAsMounted("movements");
  };

  return (
    <div className="flex flex-col gap-4 px-3 pb-4 pt-2">
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => {
          const nextTab = key as CashFlowTab;
          setActiveTab(nextTab);
          markTabAsMounted(nextTab);
        }}
        variant="secondary"
      >
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Flujo de caja"
            className="rounded-2xl border border-default-200/70 bg-default-50/30 p-1.5 shadow-sm backdrop-blur"
          >
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
          {isTabMounted("cash-flow") ? (
            <>
              <Card className="border border-default-200/70 bg-linear-to-b from-default-100/40 to-default-50/10 shadow-sm">
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
                          {monthOptionsByYear.map((monthGroup) => (
                            <ListBox.Section key={monthGroup.year}>
                              <Header>{monthGroup.year}</Header>
                              {monthGroup.options.map((monthOption) => (
                                <ListBox.Item
                                  id={monthOption.value}
                                  key={monthOption.value}
                                  textValue={monthOption.label}
                                >
                                  {monthOption.label}
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              ))}
                            </ListBox.Section>
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

                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <div className="rounded-md border border-default-200 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-tiny font-medium uppercase tracking-wide text-default-500">
                          Categorías de ingreso
                        </p>
                        <span className="text-tiny text-default-400">
                          {incomeCategorySummary.length} categorías
                        </span>
                      </div>
                      {isLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-7 w-full rounded-md" />
                          <Skeleton className="h-7 w-full rounded-md" />
                          <Skeleton className="h-7 w-full rounded-md" />
                        </div>
                      ) : incomeCategorySummary.length === 0 ? (
                        <p className="text-sm text-default-500">
                          Sin ingresos categorizados en este mes.
                        </p>
                      ) : (
                        <div className="max-h-96 space-y-2 overflow-auto pr-1">
                          {incomeCategorySummary.map((item) => (
                            <Button
                              className="group h-auto w-full justify-start rounded-md border border-default-200 p-0 text-left transition-colors hover:bg-default-100/60"
                              key={`summary-income-category-${item.type}-${item.categoryId ?? "none"}`}
                              variant="ghost"
                              onPress={() => navigateToMovementsBySummaryCategory(item)}
                            >
                              <div className="w-full space-y-1.5 px-2.5 py-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span
                                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                                      style={{
                                        backgroundColor: item.categoryColor ?? "#64748B",
                                      }}
                                    />
                                    <span className="truncate text-sm">{item.categoryName}</span>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-sm font-medium text-success">
                                      {formatCurrency(Math.abs(item.total))}
                                    </p>
                                    <p className="text-tiny text-default-500">{item.count} mov.</p>
                                  </div>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-default-200">
                                  <div
                                    className="h-full rounded-full bg-success"
                                    style={{
                                      width: `${
                                        monthlySummary.totals.income > 0
                                          ? (Math.abs(item.total) / monthlySummary.totals.income) *
                                            100
                                          : 0
                                      }%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-md border border-default-200 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-tiny font-medium uppercase tracking-wide text-default-500">
                          Categorías de egreso
                        </p>
                        <span className="text-tiny text-default-400">
                          {expenseCategorySummary.length} categorías
                        </span>
                      </div>
                      {isLoading ? (
                        <div className="space-y-2">
                          <Skeleton className="h-7 w-full rounded-md" />
                          <Skeleton className="h-7 w-full rounded-md" />
                          <Skeleton className="h-7 w-full rounded-md" />
                        </div>
                      ) : expenseCategorySummary.length === 0 ? (
                        <p className="text-sm text-default-500">
                          Sin egresos categorizados en este mes.
                        </p>
                      ) : (
                        <div className="max-h-96 space-y-2 overflow-auto pr-1">
                          {expenseCategorySummary.map((item) => (
                            <Button
                              className="group h-auto w-full justify-start rounded-md border border-default-200 p-0 text-left transition-colors hover:bg-default-100/60"
                              key={`summary-expense-category-${item.type}-${item.categoryId ?? "none"}`}
                              variant="ghost"
                              onPress={() => navigateToMovementsBySummaryCategory(item)}
                            >
                              <div className="w-full space-y-1.5 px-2.5 py-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span
                                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                                      style={{
                                        backgroundColor: item.categoryColor ?? "#64748B",
                                      }}
                                    />
                                    <span className="truncate text-sm">{item.categoryName}</span>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-sm font-medium text-danger">
                                      {formatCurrency(Math.abs(item.total))}
                                    </p>
                                    <p className="text-tiny text-default-500">{item.count} mov.</p>
                                  </div>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-default-200">
                                  <div
                                    className="h-full rounded-full bg-danger"
                                    style={{
                                      width: `${
                                        Math.abs(monthlySummary.totals.expense) > 0
                                          ? (
                                              Math.abs(item.total) /
                                                Math.abs(monthlySummary.totals.expense)
                                            ) * 100
                                          : 0
                                      }%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="border border-default-200/70 bg-linear-to-b from-default-100/40 to-default-50/10 shadow-sm">
                <div className="space-y-3 p-3">
                  <p className="text-sm font-medium">Distribución por categoría</p>
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <div className="rounded-md border border-default-200 p-3">
                      <h4 className="mb-2 text-sm font-medium">Ingresos por categoría</h4>
                      {isLoading ? (
                        <Skeleton className="h-80 w-full rounded-md" />
                      ) : incomePieData.length === 0 ? (
                        <p className="text-sm text-default-500">
                          No hay ingresos para el mes seleccionado.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(240px,1fr)_minmax(220px,260px)]">
                          <div className="h-80 min-w-0">
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
                                <Tooltip content={<CashflowPieTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="max-h-80 space-y-2 overflow-auto pr-1">
                            {incomePieData.map((entry) => {
                              const share =
                                incomePieTotal > 0 ? (entry.value / incomePieTotal) * 100 : 0;
                              return (
                                <div
                                  className="flex items-center justify-between gap-2 rounded-md border border-default-200 px-2 py-1.5 text-sm"
                                  key={`income-legend-${entry.name}`}
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span
                                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="truncate text-default-700">{entry.name}</span>
                                  </div>
                                  <div className="shrink-0 text-right text-default-500">
                                    {share.toFixed(1)}%
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="rounded-md border border-default-200 p-3">
                      <h4 className="mb-2 text-sm font-medium">Egresos por categoría</h4>
                      {isLoading ? (
                        <Skeleton className="h-80 w-full rounded-md" />
                      ) : expensePieData.length === 0 ? (
                        <p className="text-sm text-default-500">
                          No hay egresos para el mes seleccionado.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(240px,1fr)_minmax(220px,260px)]">
                          <div className="h-80 min-w-0">
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
                                <Tooltip content={<CashflowPieTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="max-h-80 space-y-2 overflow-auto pr-1">
                            {expensePieData.map((entry) => {
                              const share =
                                expensePieTotal > 0 ? (entry.value / expensePieTotal) * 100 : 0;
                              return (
                                <div
                                  className="flex items-center justify-between gap-2 rounded-md border border-default-200 px-2 py-1.5 text-sm"
                                  key={`expense-legend-${entry.name}`}
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span
                                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="truncate text-default-700">{entry.name}</span>
                                  </div>
                                  <div className="shrink-0 text-right text-default-500">
                                    {share.toFixed(1)}%
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </>
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel id="movements" className="space-y-3 pt-3">
          {isTabMounted("movements") ? (
            <Card className="overflow-hidden border border-default-200/70 bg-linear-to-b from-default-100/35 via-default-50/15 to-transparent shadow-sm">
              <div className="border-b border-default-200/70 px-4 py-3">
                <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-12">
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
                          {monthOptionsByYear.map((monthGroup) => (
                            <ListBox.Section key={monthGroup.year}>
                              <Header>{monthGroup.year}</Header>
                              {monthGroup.options.map((monthOption) => (
                                <ListBox.Item
                                  id={monthOption.value}
                                  key={monthOption.value}
                                  textValue={monthOption.label}
                                >
                                  {monthOption.label}
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              ))}
                            </ListBox.Section>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>

                  <div className="lg:col-span-3">
                    <Label className="mb-1 block">Categorías (multi)</Label>
                    <Dropdown>
                      <Dropdown.Trigger>
                        <Button
                          className="h-10 w-full justify-between rounded-xl px-3"
                          variant="secondary"
                        >
                          <span className="truncate text-left">{selectedCategoryLabel}</span>
                          <span className="text-xs text-default-500">
                            {selectedCategoryFilters.length > 0
                              ? `${selectedCategoryFilters.length} seleccionadas`
                              : "Todas"}
                          </span>
                        </Button>
                      </Dropdown.Trigger>
                      <Dropdown.Popover>
                        <div className="w-[320px] p-2">
                          <SearchField
                            aria-label="Buscar categorías"
                            className="mb-2"
                            value={categoryFilterSearch}
                            variant="secondary"
                            onChange={setCategoryFilterSearch}
                          >
                            <SearchField.Group>
                              <SearchField.SearchIcon />
                              <SearchField.Input placeholder="Buscar categoría..." />
                              <SearchField.ClearButton />
                            </SearchField.Group>
                          </SearchField>
                          <ListBox
                            className="max-h-60 overflow-auto"
                            selectedKeys={new Set(selectedCategoryFilters)}
                            selectionMode="multiple"
                            onSelectionChange={handleCategoryFilterSelection}
                          >
                            {visibleCategoryFilterOptions.map((option) => (
                              <ListBox.Item
                                id={option.value}
                                key={option.value}
                                textValue={option.label}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: option.color }}
                                  />
                                  <span>{option.label}</span>
                                </div>
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </div>
                      </Dropdown.Popover>
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

                  <div className="flex items-end lg:col-span-3">
                    <Dropdown>
                      <Dropdown.Trigger>
                        <Button
                          className="h-10 rounded-xl border-default-300/60 bg-default-100/30 px-3 text-default-600 hover:bg-default-100/60"
                          size="sm"
                          variant="outline"
                        >
                          Visibilidad
                          {visibilityFiltersCount > 0 ? (
                            <Chip size="sm" variant="soft">
                              {visibilityFiltersCount}
                            </Chip>
                          ) : null}
                        </Button>
                      </Dropdown.Trigger>
                      <Dropdown.Popover>
                        <div className="w-64 space-y-2 p-2">
                          <Switch
                            className="h-7"
                            isSelected={showNonAccountableMovements}
                            onChange={setShowNonAccountableMovements}
                          >
                            <Switch.Control>
                              <Switch.Thumb />
                            </Switch.Control>
                            <Switch.Content>
                              <Label className="text-xs text-default-600">No contabilizables</Label>
                            </Switch.Content>
                          </Switch>
                          <Switch
                            className="h-7"
                            isSelected={showOnlyUncategorizedMovements}
                            onChange={setShowOnlyUncategorizedMovements}
                          >
                            <Switch.Control>
                              <Switch.Thumb />
                            </Switch.Control>
                            <Switch.Content>
                              <Label className="text-xs text-default-600">Solo sin categoría</Label>
                            </Switch.Content>
                          </Switch>
                        </div>
                      </Dropdown.Popover>
                    </Dropdown>
                  </div>

                  <div className="flex items-end justify-end lg:col-span-2">
                    <Button
                      className="h-10 rounded-xl border-default-300/60 bg-default-100/40 px-3 text-default-700 hover:bg-default-100/70"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedCategoryFilters([]);
                        setCategoryFilterSearch("");
                        setColumnFilters(DEFAULT_COLUMN_FILTERS);
                        setShowNonAccountableMovements(false);
                        setShowOnlyUncategorizedMovements(false);
                        setPage(1);
                      }}
                    >
                      Limpiar
                    </Button>
                  </div>

                  <SearchField
                    aria-label="Buscar en desde"
                    className="lg:col-span-3"
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
                    className="lg:col-span-3"
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
                        className="h-7 rounded-full border-default-300/70 bg-default-100/40 px-3"
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

                    {showNonAccountableMovements && (
                      <Button
                        className="h-7 rounded-full px-3"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowNonAccountableMovements(false);
                          setPage(1);
                        }}
                      >
                        No contabilizables
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {showOnlyUncategorizedMovements && (
                      <Button
                        className="h-7 rounded-full px-3"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowOnlyUncategorizedMovements(false);
                          setPage(1);
                        }}
                      >
                        Solo sin categoría
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="p-2">
                <Suspense
                  fallback={<div className="p-3 text-default-500 text-sm">Cargando...</div>}
                >
                  <CashFlowTable
                    data={paginatedTransactions}
                    categories={categories}
                    total={totalFiltered}
                    isLoading={isLoading}
                    page={safePage}
                    pageSize={TABLE_PAGE_SIZE}
                    onPageChange={(nextPage) => setPage(Math.max(1, nextPage))}
                    onEdit={handleEdit}
                    onReallocate={handleOpenReallocate}
                    onCategoryChange={handleCategoryChange}
                    updatingCategoryIds={updatingCategoryIds}
                  />
                </Suspense>
              </div>
            </Card>
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel id="categories" className="space-y-3 pt-3">
          {isTabMounted("categories") ? (
            <>
              <Card className="border border-default-200/70 bg-linear-to-b from-default-100/35 to-default-50/10 shadow-sm">
                <div className="flex flex-wrap gap-2 p-2">
                  <Button
                    size="sm"
                    variant={activeCategorySection === "catalog" ? "primary" : "secondary"}
                    onPress={() => setActiveCategorySection("catalog")}
                  >
                    Catálogo de categorías
                  </Button>
                  <Button
                    size="sm"
                    variant={activeCategorySection === "rules" ? "primary" : "secondary"}
                    onPress={() => setActiveCategorySection("rules")}
                  >
                    Reglas automáticas
                  </Button>
                  <Button
                    size="sm"
                    variant={activeCategorySection === "compensation" ? "primary" : "secondary"}
                    onPress={() => setActiveCategorySection("compensation")}
                  >
                    Perfiles de compensación
                  </Button>
                </div>
              </Card>

              {activeCategorySection === "catalog" ? (
                <>
                  <Card className="border border-default-200/70 bg-linear-to-b from-default-100/40 to-default-50/10 shadow-sm">
                    <div className="p-3">
                      <form
                        className="grid grid-cols-1 gap-4 md:grid-cols-5 md:items-end"
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
                          className="md:self-end"
                          label="Color"
                          value={newCategoryColor}
                          onChange={setNewCategoryColor}
                        />
                        <div className="flex h-full items-end pb-1">
                          <Switch
                            isSelected={newCategoryIsNonAccountable}
                            onChange={(value) => setNewCategoryIsNonAccountable(value)}
                          >
                            <Switch.Control>
                              <Switch.Thumb />
                            </Switch.Control>
                            <Switch.Content>
                              <Label>No contabilizable</Label>
                            </Switch.Content>
                          </Switch>
                        </div>

                        <div className="md:col-span-5">
                          <Button type="submit" isPending={createCategoryMutation.isPending}>
                            {({ isPending }) => (isPending ? "Creando..." : "Crear categoría")}
                          </Button>
                        </div>
                      </form>
                    </div>
                  </Card>

                  <Card className="border border-default-200/70 bg-linear-to-b from-default-100/40 to-default-50/10 shadow-sm">
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
                                <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-[1fr_160px_130px_90px_auto] md:items-end">
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
                                    className="md:self-end"
                                    label="Color"
                                    value={editingCategoryColor}
                                    onChange={setEditingCategoryColor}
                                  />
                                  <div className="flex h-full items-end pb-1">
                                    <Switch
                                      isSelected={editingCategoryIsNonAccountable}
                                      onChange={(value) =>
                                        setEditingCategoryIsNonAccountable(value)
                                      }
                                    >
                                      <Switch.Control>
                                        <Switch.Thumb />
                                      </Switch.Control>
                                      <Switch.Content>
                                        <Label>No contabilizable</Label>
                                      </Switch.Content>
                                    </Switch>
                                  </div>
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
                                    {isNonAccountableCategory(category) ? (
                                      <Chip color="warning" size="sm" variant="soft">
                                        No contabilizable
                                      </Chip>
                                    ) : null}
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
                </>
              ) : null}

              {activeCategorySection === "compensation" ? (
                <Card className="border border-default-200/70 bg-linear-to-b from-default-100/40 to-default-50/10 shadow-sm">
                  <div className="space-y-3 p-3">
                    <h3 className="text-sm font-semibold">Perfiles de compensación (sueldos)</h3>
                    <form
                      className="grid grid-cols-1 gap-3 md:grid-cols-6"
                      onSubmit={handleCreateCompensationProfile}
                    >
                      <TextField className="md:col-span-2">
                        <Label>Nombre perfil</Label>
                        <Input
                          placeholder="Ej: Sueldo Lucas"
                          value={newCompensationName}
                          onChange={(e) => setNewCompensationName(e.target.value)}
                        />
                      </TextField>
                      <Select
                        className="md:col-span-2"
                        value={
                          newCompensationCategoryId == null
                            ? null
                            : String(newCompensationCategoryId)
                        }
                        onChange={(key) => {
                          const value = key == null ? null : Number(key);
                          setNewCompensationCategoryId(value);
                        }}
                      >
                        <Label>Categoría (egreso)</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {categoryOptionsByType.EXPENSE.map((category) => (
                              <ListBox.Item id={String(category.id)} key={category.id}>
                                {category.name}
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                      <Select
                        value={
                          newCompensationCounterpartId == null
                            ? "__none__"
                            : String(newCompensationCounterpartId)
                        }
                        onChange={(key) => {
                          const value =
                            key == null || String(key) === "__none__" ? null : Number(key);
                          setNewCompensationCounterpartId(value);
                        }}
                      >
                        <Label>Contraparte (opcional)</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            <ListBox.Item id="__none__">Sin restricción</ListBox.Item>
                            {counterpartOptions.map((counterpart) => (
                              <ListBox.Item id={String(counterpart.value)} key={counterpart.value}>
                                {counterpart.label}
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                      <div className="flex h-full items-end pb-1">
                        <Switch
                          isSelected={newCompensationIsActive}
                          onChange={(value) => setNewCompensationIsActive(value)}
                        >
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                          <Switch.Content>
                            <Label>Activo</Label>
                          </Switch.Content>
                        </Switch>
                      </div>
                      <div className="md:col-span-6">
                        <Button
                          type="submit"
                          isPending={createCompensationProfileMutation.isPending}
                        >
                          Crear perfil de compensación
                        </Button>
                      </div>
                    </form>

                    {activeCompensationProfiles.length === 0 ? (
                      <p className="text-default-500 text-sm">
                        No hay perfiles de compensación activos.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_1fr]">
                        <div className="space-y-2">
                          {activeCompensationProfiles.map((profile) => (
                            <button
                              className={`w-full rounded-md border px-3 py-2 text-left transition ${
                                selectedCompensationProfileId === profile.id
                                  ? "border-primary bg-primary-50/40"
                                  : "border-default-200 hover:bg-default-100/40"
                              }`}
                              key={profile.id}
                              type="button"
                              onClick={() => setSelectedCompensationProfileId(profile.id)}
                            >
                              <p className="text-sm font-medium">{profile.name}</p>
                              <p className="text-tiny text-default-500">
                                {profile.category.name}
                                {profile.counterpart
                                  ? ` · ${profile.counterpart.bankAccountHolder}`
                                  : " · sin contraparte fija"}
                              </p>
                            </button>
                          ))}
                        </div>
                        <div className="space-y-2 rounded-md border border-default-200 p-3">
                          <p className="text-sm font-medium">Ledger período {selectedMonth}</p>
                          <p className="text-tiny text-default-500">
                            Presupuesto, imputado y diferencia para cuadrar arrastres.
                          </p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <div className="rounded-md border border-default-200 px-2 py-1.5">
                              <p className="text-tiny text-default-500">Presupuesto</p>
                              <p className="text-sm font-semibold">
                                {formatCurrency(selectedCompensationEntry?.budgetAmount ?? 0)}
                              </p>
                            </div>
                            <div className="rounded-md border border-default-200 px-2 py-1.5">
                              <p className="text-tiny text-default-500">Imputado</p>
                              <p className="text-sm font-semibold">
                                {formatCurrency(selectedCompensationEntry?.allocatedAmount ?? 0)}
                              </p>
                            </div>
                            <div className="rounded-md border border-default-200 px-2 py-1.5">
                              <p className="text-tiny text-default-500">Diferencia</p>
                              <p
                                className={`text-sm font-semibold ${
                                  (selectedCompensationEntry?.variance ?? 0) >= 0
                                    ? "text-success"
                                    : "text-danger"
                                }`}
                              >
                                {formatCurrency(selectedCompensationEntry?.variance ?? 0)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-end gap-2">
                            <TextField>
                              <Label>Presupuesto mes</Label>
                              <Input
                                inputMode="decimal"
                                placeholder="Ej: 1500000"
                                value={budgetAmountInput}
                                onChange={(e) =>
                                  setBudgetAmountInput(e.target.value.replace(/[^0-9.-]/g, ""))
                                }
                              />
                            </TextField>
                            <Button
                              isPending={upsertCompensationBudgetMutation.isPending}
                              onPress={handleSavePeriodBudget}
                            >
                              Guardar presupuesto
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ) : null}

              {activeCategorySection === "rules" ? (
                <Card>
                  <div className="space-y-3 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">Reglas automáticas por contraparte</h3>
                      <Button
                        size="sm"
                        variant="secondary"
                        isPending={syncUncategorizedByPatternsMutation.isPending}
                        onPress={() => syncUncategorizedByPatternsMutation.mutate()}
                      >
                        Sincronizar sin categoría
                      </Button>
                    </div>
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
                          const value =
                            key == null || String(key) === "__none__" ? null : Number(key);
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
                          onChange={(e) =>
                            setNewRulePriority(e.target.value.replace(/[^\d-]/g, ""))
                          }
                        />
                      </TextField>
                      <TextField>
                        <Label>Monto mínimo</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="0"
                          value={newRuleMinAmount}
                          onChange={(e) =>
                            setNewRuleMinAmount(e.target.value.replace(/[^0-9.-]/g, ""))
                          }
                        />
                      </TextField>
                      <TextField>
                        <Label>Monto máximo</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="200000"
                          value={newRuleMaxAmount}
                          onChange={(e) =>
                            setNewRuleMaxAmount(e.target.value.replace(/[^0-9.-]/g, ""))
                          }
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
                      <p className="text-default-500 text-sm">
                        No hay reglas automáticas configuradas.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {autoCategoryRules.map((rule) => (
                          <div
                            key={rule.id}
                            className="rounded-md border border-default-200 px-3 py-2"
                          >
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
                                      key == null || String(key) === "__none__"
                                        ? null
                                        : Number(key);
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
                                    setEditingRuleType(
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
                                    editingRuleCategoryId == null
                                      ? null
                                      : String(editingRuleCategoryId)
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
                                      setEditingRuleMinAmount(
                                        e.target.value.replace(/[^0-9.-]/g, ""),
                                      )
                                    }
                                  />
                                </TextField>
                                <TextField>
                                  <Label>Monto máximo</Label>
                                  <Input
                                    inputMode="decimal"
                                    value={editingRuleMaxAmount}
                                    onChange={(e) =>
                                      setEditingRuleMaxAmount(
                                        e.target.value.replace(/[^0-9.-]/g, ""),
                                      )
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
                                    onChange={(e) =>
                                      setEditingRuleDescriptionContains(e.target.value)
                                    }
                                  />
                                </TextField>
                                <Select
                                  value={editingRuleIsActive ? "ACTIVE" : "INACTIVE"}
                                  onChange={(key) =>
                                    setEditingRuleIsActive(String(key) === "ACTIVE")
                                  }
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
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onPress={handleCancelEditRule}
                                  >
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
                                    {rule.type === "INCOME" ? "Ingreso" : "Egreso"} |{" "}
                                    {rule.category.name} | prioridad {rule.priority} |{" "}
                                    {rule.isActive ? "Activa" : "Inactiva"}
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
              ) : null}
            </>
          ) : null}
        </Tabs.Panel>
      </Tabs>

      {isFormOpen ? (
        <Suspense fallback={null}>
          <TransactionForm
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            initialData={editingTx}
          />
        </Suspense>
      ) : null}

      <Modal>
        <Modal.Backdrop
          isOpen={isReallocateOpen}
          onOpenChange={(open) => !open && setIsReallocateOpen(false)}
        >
          <Modal.Container size="md">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Reasignar Movimiento a Otro Período</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <form
                  className="space-y-3"
                  id="reallocate-form"
                  onSubmit={handleSubmitReallocation}
                >
                  <Description className="text-sm text-default-600">
                    Selecciona perfil y período destino para arrastrar parte del monto.
                  </Description>
                  <TextField>
                    <Label>Movimiento</Label>
                    <Input
                      readOnly
                      value={
                        reallocateTx
                          ? `${dayjs(reallocateTx.date).format("DD-MM-YYYY")} · ${reallocateTx.description}`
                          : ""
                      }
                    />
                  </TextField>

                  <Select
                    value={reallocateProfileId == null ? null : String(reallocateProfileId)}
                    onChange={(key) => {
                      const value = key == null ? null : Number(key);
                      setReallocateProfileId(value);
                    }}
                  >
                    <Label>Perfil de compensación</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {reallocationProfileOptions.map((profile) => (
                          <ListBox.Item id={String(profile.id)} key={profile.id}>
                            {profile.name} · {profile.category.name}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <TextField>
                      <Label>Período origen</Label>
                      <Input readOnly value={formatMonthLabel(reallocateFromPeriod)} />
                    </TextField>
                    <Select
                      value={reallocateTargetPeriod}
                      onChange={(key) => setReallocateTargetPeriod(String(key ?? ""))}
                    >
                      <Label>Período destino</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {targetPeriodOptions.map((option) => (
                            <ListBox.Item id={option.value} key={option.value}>
                              {option.label}
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>

                  <TextField>
                    <Label>Monto a arrastrar</Label>
                    <Input
                      inputMode="decimal"
                      min={0}
                      placeholder="Ej: 120000"
                      step="0.01"
                      type="number"
                      value={reallocateAmount == null ? "" : String(reallocateAmount)}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "") {
                          setReallocateAmount(null);
                          return;
                        }
                        const parsed = Number(value);
                        setReallocateAmount(Number.isFinite(parsed) ? parsed : null);
                      }}
                    />
                  </TextField>
                </form>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={() => setIsReallocateOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  form="reallocate-form"
                  isPending={reallocateTransactionMutation.isPending}
                  type="submit"
                >
                  Reasignar
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
