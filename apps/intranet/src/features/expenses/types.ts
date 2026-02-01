export interface CreateMonthlyExpensePayload {
  amountExpected: number;
  category?: null | string;
  expenseDate: Date;
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
  createdAt: Date;
  expenseDate: Date;
  name: string;
  notes: null | string;
  publicId: string;
  serviceId: null | number;
  source: MonthlyExpenseSource;
  status: "CLOSED" | "OPEN";
  tags: string[];
  transactionCount: number;
  updatedAt: Date;
}

export type MonthlyExpenseDetail = MonthlyExpense & {
  transactions: {
    amount: number;
    description: null | string;
    direction: string;
    timestamp: Date;
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
