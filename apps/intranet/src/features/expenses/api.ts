import { compactORPCInput } from "@/lib/orpc-input";
import { expensesORPCClient, toExpensesApiError } from "./orpc";
import type {
  Expense,
  ExpenseDetail,
  ExpenseRecurrence,
  ExpenseScope,
  ExpenseService,
  ExpenseStatsRow,
  ExpenseStatus,
} from "./types";

// ─── Expense CRUD ─────────────────────────────────────────────────────────────

export interface CreateExpensePayload {
  amountExpected: number;
  category?: null | string;
  detail?: null | string;
  dueDate?: null | string;
  expenseMonth: string; // YYYY-MM
  name: string;
  notes?: null | string;
  scope: ExpenseScope;
  serviceId?: null | number;
  source?: "MANUAL" | "TEMPLATE" | "TRANSACTION";
  status?: "OVERDUE" | "PAID" | "PENDING" | "SKIPPED";
  tags?: string[];
}

export async function createExpense(
  payload: CreateExpensePayload
): Promise<{ expense: ExpenseDetail; status: "ok" }> {
  try {
    const result = await expensesORPCClient.create(payload);
    return result as { expense: ExpenseDetail; status: "ok" };
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function fetchExpenseDetail(
  publicId: string
): Promise<{ expense: ExpenseDetail; status: "ok" }> {
  try {
    const result = await expensesORPCClient.detail({ publicId });
    return result as { expense: ExpenseDetail; status: "ok" };
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function fetchExpenses(params?: {
  from?: string;
  scope?: ExpenseScope;
  serviceId?: null | number;
  status?: ExpenseStatus;
  to?: string;
}): Promise<{ expenses: Expense[]; status: "ok" }> {
  try {
    const result = await expensesORPCClient.list(compactORPCInput(params) ?? {});
    return { expenses: result.expenses as Expense[], status: "ok" };
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function fetchExpenseStats(params?: {
  from?: string;
  groupBy?: "month" | "quarter" | "year";
  scope?: ExpenseScope;
  to?: string;
}): Promise<{ stats: ExpenseStatsRow[]; status: "ok" }> {
  try {
    const result = await expensesORPCClient.stats(compactORPCInput(params) ?? {});
    return { stats: result.stats as ExpenseStatsRow[], status: "ok" };
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function linkExpenseTransaction(
  publicId: string,
  payload: { amount?: number; transactionId: number }
): Promise<{ status: "ok" }> {
  try {
    return await expensesORPCClient.linkTransaction({ publicId, ...payload });
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function unlinkExpenseTransaction(
  publicId: string,
  transactionId: number
): Promise<{ status: "ok" }> {
  try {
    return await expensesORPCClient.unlinkTransaction({ publicId, transactionId });
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function updateExpense(
  publicId: string,
  payload: CreateExpensePayload
): Promise<{ expense: ExpenseDetail; status: "ok" }> {
  try {
    const result = await expensesORPCClient.update({ publicId, payload });
    return result as { expense: ExpenseDetail; status: "ok" };
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

// ─── Generate from templates ──────────────────────────────────────────────────

export async function generateExpensesFromTemplates(
  month: string,
  overwrite?: boolean
): Promise<{ created: number; skipped: number; status: "ok" }> {
  try {
    const input = overwrite !== undefined ? { month, overwrite } : { month };
    return await expensesORPCClient.generateFromTemplates(input);
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

// ─── ExpenseService CRUD ──────────────────────────────────────────────────────

export interface CreateExpenseServicePayload {
  billingDay?: null | number;
  category?: null | string;
  defaultAmount?: null | number;
  detail?: null | string;
  dueDateRule?: null | string;
  endDate?: null | string;
  isActive?: boolean;
  isFixed?: boolean;
  name: string;
  notes?: null | string;
  recurrence?: ExpenseRecurrence;
  scope: ExpenseScope;
  startDate?: null | string;
  tags?: string[];
}

export async function fetchExpenseServices(params?: {
  isActive?: boolean;
  scope?: ExpenseScope;
}): Promise<{ services: ExpenseService[]; status: "ok" }> {
  try {
    const result = await expensesORPCClient.listServices(compactORPCInput(params) ?? {});
    return { services: result.services as ExpenseService[], status: "ok" };
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function createExpenseService(
  payload: CreateExpenseServicePayload
): Promise<{ service: ExpenseService; status: "ok" }> {
  try {
    const result = await expensesORPCClient.createService(payload);
    return result as { service: ExpenseService; status: "ok" };
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function updateExpenseService(
  id: number,
  payload: CreateExpenseServicePayload
): Promise<{ service: ExpenseService; status: "ok" }> {
  try {
    const result = await expensesORPCClient.updateService({ id, payload });
    return result as { service: ExpenseService; status: "ok" };
  } catch (error) {
    throw toExpensesApiError(error);
  }
}

export async function deleteExpenseService(id: number): Promise<{ status: "ok" }> {
  try {
    return await expensesORPCClient.deleteService({ id });
  } catch (error) {
    throw toExpensesApiError(error);
  }
}
