export interface CreateMonthlyExpensePayload {
  amountExpected: number;
  category?: null | string;
  expenseDate: string;
  name: string;
  notes?: null | string;
  serviceId?: null | number;
  source?: MonthlyExpenseSource;
  status?: "CLOSED" | "OPEN";
  tags?: string[];
}

export interface LinkMonthlyExpenseTransactionPayload {
  amount?: number;
  transactionId: number;
}

export interface MonthlyExpense {
  amountApplied: number;
  amountExpected: number;
  category: null | string;
  createdAt: string;
  expenseDate: string;
  name: string;
  notes: null | string;
  publicId: string;
  serviceId: null | number;
  source: MonthlyExpenseSource;
  status: "CLOSED" | "OPEN";
  tags: string[];
  transactionCount: number;
  updatedAt: string;
}

export type MonthlyExpenseDetail = MonthlyExpense & {
  transactions: {
    amount: number;
    description: null | string;
    direction: string;
    timestamp: string;
    transactionId: number;
  }[];
};

export type MonthlyExpenseSource = "MANUAL" | "SERVICE" | "TRANSACTION";

export interface MonthlyExpenseStatsRow {
  expenseCount: number;
  period: string;
  totalApplied: number;
  totalExpected: number;
}
