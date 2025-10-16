export type MonthlyExpenseSource = "MANUAL" | "TRANSACTION" | "SERVICE";

export type MonthlyExpense = {
  publicId: string;
  name: string;
  category: string | null;
  amountExpected: number;
  expenseDate: string;
  notes: string | null;
  source: MonthlyExpenseSource;
  serviceId: number | null;
  tags: string[];
  status: "OPEN" | "CLOSED";
  amountApplied: number;
  transactionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyExpenseDetail = MonthlyExpense & {
  transactions: Array<{
    transactionId: number;
    amount: number;
    timestamp: string;
    description: string | null;
    direction: string;
  }>;
};

export type CreateMonthlyExpensePayload = {
  name: string;
  category?: string | null;
  amountExpected: number;
  expenseDate: string;
  notes?: string | null;
  source?: MonthlyExpenseSource;
  serviceId?: number | null;
  tags?: string[];
  status?: "OPEN" | "CLOSED";
};

export type MonthlyExpenseStatsRow = {
  period: string;
  totalExpected: number;
  totalApplied: number;
  expenseCount: number;
};

export type LinkMonthlyExpenseTransactionPayload = {
  transactionId: number;
  amount?: number;
};
