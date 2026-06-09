// Centralized query-key factories for the finance feature.
//
// Hierarchical const pattern (mirrors features/calendar/queries.ts `calendarKeys`
// and features/patients/queries.ts `patientKeys`).
//
// IMPORTANT: the array SHAPES below are load-bearing. Every queryKey and its
// matching invalidateQueries / getQueriesData / setQueriesData / cancelQueries
// call MUST stay structurally identical, or TanStack's prefix-based matching
// silently breaks. Each `all` base is a structural PREFIX of its children so a
// broad invalidateQueries(<entity>.all) cascades to the narrower entries
// (e.g. cashflowKeys.financialTransactions.all === ["FinancialTransaction"]
// matches the list query keyed ["FinancialTransaction", params]).
//
// These keys mirror the raw model-named literals previously inlined in
// pages/CashFlowPage.tsx; resolved arrays are intentionally unchanged.
export const cashflowKeys = {
  autoCategoryRules: {
    all: ["FinancialAutoCategoryRule"] as const,
  },
  compensationLedger: {
    all: ["CompensationLedger"] as const,
    entry: (profileId: null | number, fromPeriod: string, toPeriod: string) =>
      ["CompensationLedger", profileId, fromPeriod, toPeriod] as const,
  },
  compensationProfiles: {
    all: ["CompensationProfile"] as const,
  },
  counterparts: {
    all: ["Counterpart"] as const,
  },
  financialTransactions: {
    all: ["FinancialTransaction"] as const,
    availableMonths: ["FinancialTransaction", "available-months"] as const,
    categoryFrequencies: ["FinancialTransaction", "category-frequencies"] as const,
    list: (params: unknown) => ["FinancialTransaction", params] as const,
  },
  transactionCategories: {
    all: ["TransactionCategory"] as const,
  },
} as const;

// Centralized query-key factory for the recurring-expenses surface
// (components/ExpensesPanel.tsx, ExpenseServicesModal.tsx, ExpenseLinkModal.tsx).
//
// `expenseKeys.all` (= ["expenses"]) is a structural PREFIX of every expenses
// child key, so invalidateQueries(expenseKeys.all) refreshes list + stats +
// services together (the broad invalidation used after generate / reconcile /
// link). `financeForLink` / `financeRoot` cover the cross-cutting ["finance", ...]
// keys the link modal reads & invalidates.
export const expenseKeys = {
  all: ["expenses"] as const,
  financeForLink: (search: string) => ["finance", "transactions", "for-link", search] as const,
  financeRoot: ["finance"] as const,
  list: (scope: string, month: string) => ["expenses", "list", scope, month] as const,
  services: ["expenses", "services"] as const,
  stats: (scope: string, month: string) => ["expenses", "stats", scope, month] as const,
} as const;
