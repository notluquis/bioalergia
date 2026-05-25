// DTE → Expense matcher
//
// Pipeline: DTEPurchaseDetail.providerRUT  →  Counterpart.identificationNumber
//                                           →  ExpenseService.counterpartId
//                                           →  Expense (mes correspondiente)
//
// Idempotente. Match-by-rule, no IA. Si no hay match, deja DTE sin expenseId.
// Trigger sin cron: se llama inline después de cada DTE insert (fail-soft)
// + endpoint manual reconcileUnmatched para UI button.

import { db } from "@finanzas/db";
import { Decimal } from "decimal.js";

export interface MatchResult {
  dteId: string;
  expenseId: null | number;
  reason: string;
  status: "ALREADY_LINKED" | "CREATED_EXPENSE" | "LINKED_EXISTING" | "NO_MATCH" | "ERROR";
}

// Convierte period YYYYMM (DTE) o documentDate → expenseMonth YYYY-MM
function deriveExpenseMonth(period: null | string, documentDate: Date): string {
  if (period && period.length === 6) {
    return `${period.slice(0, 4)}-${period.slice(4, 6)}`;
  }
  const y = documentDate.getFullYear();
  const m = String(documentDate.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Intenta linkear un DTE compra al Expense correspondiente.
 * Si no existe Expense del mes, lo crea automáticamente desde ExpenseService.
 * Fail-soft: nunca tira excepción, devuelve status.
 */
export async function tryMatchDTEPurchaseToExpense(dteId: string): Promise<MatchResult> {
  try {
    const dte = await db.dTEPurchaseDetail.findFirst({ where: { id: dteId } });

    if (!dte) {
      return { dteId, expenseId: null, reason: "DTE not found", status: "ERROR" };
    }

    if (dte.expenseId) {
      return {
        dteId,
        expenseId: dte.expenseId,
        reason: "DTE already linked",
        status: "ALREADY_LINKED",
      };
    }

    // 1. Lookup counterpart by providerRUT
    const counterpart = await db.counterpart.findFirst({
      where: { identificationNumber: dte.providerRUT },
    });

    if (!counterpart) {
      return {
        dteId,
        expenseId: null,
        reason: `No Counterpart found for RUT ${dte.providerRUT}`,
        status: "NO_MATCH",
      };
    }

    // 2. Lookup ExpenseService linked to this counterpart
    const expenseService = await db.expenseService.findFirst({
      where: { counterpartId: counterpart.id, isActive: true },
    });

    if (!expenseService) {
      return {
        dteId,
        expenseId: null,
        reason: `No ExpenseService configured for Counterpart ${counterpart.bankAccountHolder} (id=${counterpart.id})`,
        status: "NO_MATCH",
      };
    }

    // 3. Determine expense month
    const expenseMonth = deriveExpenseMonth(dte.period, dte.documentDate);

    // 4. Find or create Expense for that month
    let expense = await db.expense.findFirst({
      where: { serviceId: expenseService.id, expenseMonth },
    });

    let createdNew = false;
    if (!expense) {
      // Create new Expense from ExpenseService template
      expense = await db.expense.create({
        data: {
          amountApplied: new Decimal(0),
          amountExpected: dte.totalAmount,
          category: expenseService.category ?? null,
          detail: expenseService.detail ?? null,
          dueDate: dte.documentDate, // será refinada por billingDay si Lucas lo quiere
          expenseMonth,
          name: expenseService.name,
          notes: `Auto-creado desde DTE compra folio ${dte.folio}`,
          publicId: `dte_${dteId.slice(0, 8)}_${expenseMonth}`,
          scope: expenseService.scope,
          serviceId: expenseService.id,
          source: "TRANSACTION",
          status: "PENDING",
          tags: ["auto-dte"],
        },
      });
      createdNew = true;
    }

    // 5. Link DTE → Expense
    await db.dTEPurchaseDetail.update({
      where: { id: dteId },
      data: {
        expenseId: expense.id,
        matchedAt: new Date(),
        matchSource: "AUTO",
      },
    });

    return {
      dteId,
      expenseId: expense.id,
      reason: createdNew
        ? `Created Expense ${expenseMonth} for ${expenseService.name}`
        : `Linked to existing Expense ${expenseMonth} for ${expenseService.name}`,
      status: createdNew ? "CREATED_EXPENSE" : "LINKED_EXISTING",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { dteId, expenseId: null, reason: msg, status: "ERROR" };
  }
}

/**
 * Reconcilia todos los DTEs sin link en una ventana de tiempo.
 * Llamable manualmente desde UI (orpc endpoint) o desde un job admin.
 */
export async function reconcileUnmatchedDTEs(
  options: {
    daysBack?: number;
    limit?: number;
  } = {}
): Promise<{
  results: MatchResult[];
  summary: {
    alreadyLinked: number;
    createdExpense: number;
    error: number;
    linkedExisting: number;
    noMatch: number;
    total: number;
  };
}> {
  const daysBack = options.daysBack ?? 90;
  const limit = options.limit ?? 500;
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const unmatched = await db.dTEPurchaseDetail.findMany({
    orderBy: { documentDate: "desc" },
    take: limit,
    where: {
      documentDate: { gte: since },
      expenseId: null,
    },
  });

  const results: MatchResult[] = [];
  for (const dte of unmatched) {
    results.push(await tryMatchDTEPurchaseToExpense(dte.id));
  }

  const summary = {
    alreadyLinked: results.filter((r) => r.status === "ALREADY_LINKED").length,
    createdExpense: results.filter((r) => r.status === "CREATED_EXPENSE").length,
    error: results.filter((r) => r.status === "ERROR").length,
    linkedExisting: results.filter((r) => r.status === "LINKED_EXISTING").length,
    noMatch: results.filter((r) => r.status === "NO_MATCH").length,
    total: results.length,
  };

  return { results, summary };
}

/**
 * Link manual de DTE a un Expense específico (override por UI).
 */
export async function linkDTEToExpense(dteId: string, expenseId: number): Promise<MatchResult> {
  const expense = await db.expense.findFirst({ where: { id: expenseId } });
  if (!expense) {
    return { dteId, expenseId: null, reason: "Expense not found", status: "ERROR" };
  }

  await db.dTEPurchaseDetail.update({
    where: { id: dteId },
    data: {
      expenseId,
      matchedAt: new Date(),
      matchSource: "MANUAL",
    },
  });

  return {
    dteId,
    expenseId,
    reason: "Manual link",
    status: "LINKED_EXISTING",
  };
}

/**
 * Quita el link entre un DTE y su Expense (undo).
 */
export async function unlinkDTE(dteId: string): Promise<void> {
  await db.dTEPurchaseDetail.update({
    where: { id: dteId },
    data: {
      expenseId: null,
      matchedAt: null,
      matchSource: null,
    },
  });
}
