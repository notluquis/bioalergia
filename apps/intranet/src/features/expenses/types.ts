export type ExpenseScope = "BIOALERGIA" | "PERSONAL";
export type ExpenseStatus = "OVERDUE" | "PAID" | "PENDING" | "SKIPPED";
export type ExpenseSource = "MANUAL" | "TEMPLATE" | "TRANSACTION";
export type ExpenseRecurrence = "MONTHLY" | "ONE_TIME";

export interface Expense {
  amountApplied: number;
  amountExpected: number;
  category: null | string;
  createdAt: Date;
  detail: null | string;
  dueDate: Date | null;
  expenseMonth: string; // YYYY-MM
  name: string;
  notes: null | string;
  publicId: string;
  scope: ExpenseScope;
  serviceId: null | number;
  source: ExpenseSource;
  status: ExpenseStatus;
  tags: string[];
  transactionCount: number;
  updatedAt: Date;
}

export type ExpenseDetail = Expense & {
  transactions: {
    amount: number;
    description: null | string;
    direction: string;
    timestamp: Date;
    transactionId: number;
  }[];
};

export interface ExpenseService {
  billingDay: null | number;
  category: null | string;
  createdAt: Date;
  defaultAmount: null | number;
  detail: null | string;
  dueDateRule: null | string;
  endDate: Date | null;
  id: number;
  isActive: boolean;
  isFixed: boolean;
  name: string;
  notes: null | string;
  publicId: string;
  recurrence: ExpenseRecurrence;
  scope: ExpenseScope;
  startDate: Date | null;
  tags: string[];
  updatedAt: Date;
}

export interface ExpenseStatsRow {
  expenseCount: number;
  period: string;
  scope: ExpenseScope | null;
  totalApplied: number;
  totalExpected: number;
}
