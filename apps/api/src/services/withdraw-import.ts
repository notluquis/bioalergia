import { db } from "@finanzas/db";
import type { csvUploadModeSchema } from "@finanzas/orpc-contracts/csv-upload";
import { Decimal } from "decimal.js";
import { parseChileDateTime } from "../lib/time.ts";
import {
  createMpSyncLogEntry,
  finalizeMpSyncLogEntry,
  insertMpImportChanges,
  type MpImportChangeInput,
} from "./mercadopago-sync.ts";

// Lógica de importación de retiros (MercadoPago withdrawals) desde CSV, fuera
// del handler oRPC (golden 2026: handlers finos). El handler valida input +
// authz y delega acá; este servicio parsea, clasifica insert/update, hace los
// writes (counterpart upsert + withdrawTransaction create/update), maneja el
// ciclo del sync-log y el audit fail-soft de cambios de campos.

type CsvUploadMode = typeof csvUploadModeSchema._output;
type CsvUploadRow = Record<string, number | string>;

type WithdrawImportRow = {
  activityUrl: null | string;
  amount: null | number;
  bankAccountHolder: null | string;
  bankAccountNumber: null | string;
  bankAccountType: null | string;
  bankBranch: null | string;
  bankId: null | string;
  bankName: null | string;
  dateCreated: Date;
  fee: null | number;
  identificationNumber: null | string;
  identificationType: null | string;
  payoutDescription: null | string;
  rowIndex: number;
  status: null | string;
  statusDetail: null | string;
  withdrawId: string;
};

type ExistingWithdrawRow = Record<string, unknown> & { withdrawId: string };

const UPSERT_CHUNK_SIZE = Number(process.env.BIOALERGIA_UPSERT_CHUNK_SIZE || 250);
const NON_RUT_CHARS_REGEX = /[^0-9k]/gi;

// Tracked for the field-change audit. withdrawId + dateCreated are keys → excluded.
const WITHDRAW_AUDIT_FIELDS = [
  "identificationNumber",
  "status",
  "statusDetail",
  "amount",
  "fee",
  "bankAccountHolder",
  "identificationType",
  "bankId",
  "bankName",
  "bankBranch",
  "bankAccountType",
  "bankAccountNumber",
  "payoutDescription",
] as const satisfies readonly (keyof WithdrawImportRow)[];

export type WithdrawalPreview = {
  errors?: string[];
  insertRowIndexes?: number[];
  status: "ok";
  toInsert: number;
  toSkip: number;
  toUpdate: number;
  updateRows?: Array<{
    key: string;
    rowIndex: number;
    summary: string;
  }>;
};

export type WithdrawalImportResult = {
  errors?: string[];
  inserted: number;
  skipped: number;
  status: "ok";
  toInsert: number;
  toSkip: number;
  toUpdate: number;
  updated: number;
};

// ── Normalizers ─────────────────────────────────────────────────────────────

function normalizeNullableString(value: unknown): null | string {
  if (value == null) {
    return null;
  }
  const stringValue =
    typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
  return stringValue.length > 0 ? stringValue : null;
}

function normalizeRequiredString(value: unknown): string {
  return normalizeNullableString(value) ?? "";
}

function normalizeRut(value: unknown): null | string {
  const normalized = normalizeNullableString(value)?.replace(NON_RUT_CHARS_REGEX, "").toUpperCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeNumber(value: unknown): null | number {
  if (value == null) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.replaceAll(".", "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDecimal(value: null | number) {
  return value == null ? null : new Decimal(value);
}

function normalizeDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const stringValue = normalizeNullableString(value);
  if (!stringValue) {
    return null;
  }

  return parseChileDateTime(stringValue);
}

function summarizeWithdrawalRow(row: WithdrawImportRow): string {
  const amountLabel = row.amount == null ? "-" : row.amount.toLocaleString("es-CL");
  const holder = row.bankAccountHolder ?? row.identificationNumber ?? "Sin titular";
  return `${row.withdrawId} · ${holder} · $${amountLabel}`;
}

// ── Parse / classify ──────────────────────────────────────────────────────

export function parseWithdrawalRows(rows: CsvUploadRow[]): {
  errors: string[];
  validRows: WithdrawImportRow[];
} {
  const errors: string[] = [];
  const validRows: WithdrawImportRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const withdrawId = normalizeRequiredString(row.withdrawId);
    const dateCreated = normalizeDate(row.dateCreated);

    if (!withdrawId) {
      errors.push(`Fila ${rowNumber}: withdrawId es obligatorio.`);
      return;
    }

    if (!dateCreated) {
      errors.push(`Fila ${rowNumber}: dateCreated es obligatorio y debe ser una fecha válida.`);
      return;
    }

    validRows.push({
      activityUrl: normalizeNullableString(row.activityUrl),
      amount: normalizeNumber(row.amount),
      bankAccountHolder: normalizeNullableString(row.bankAccountHolder),
      bankAccountNumber: normalizeNullableString(row.bankAccountNumber),
      bankAccountType: normalizeNullableString(row.bankAccountType),
      bankBranch: normalizeNullableString(row.bankBranch),
      bankId: normalizeNullableString(row.bankId),
      bankName: normalizeNullableString(row.bankName),
      dateCreated,
      fee: normalizeNumber(row.fee),
      identificationNumber: normalizeRut(row.identificationNumber),
      identificationType: normalizeNullableString(row.identificationType),
      payoutDescription: normalizeNullableString(row.payoutDescription),
      rowIndex: index,
      status: normalizeNullableString(row.status),
      statusDetail: normalizeNullableString(row.statusDetail),
      withdrawId,
    });
  });

  return { errors, validRows };
}

async function ensureCounterpartsExist(rows: WithdrawImportRow[]): Promise<void> {
  const counterparts = new Map<string, string>();

  for (const row of rows) {
    if (!row.identificationNumber) {
      continue;
    }
    if (!counterparts.has(row.identificationNumber)) {
      counterparts.set(
        row.identificationNumber,
        row.bankAccountHolder?.trim() || row.identificationNumber
      );
    }
  }

  for (const [identificationNumber, bankAccountHolder] of counterparts) {
    await db.counterpart.upsert({
      create: {
        bankAccountHolder,
        category: "SUPPLIER",
        identificationNumber,
      },
      update: {
        bankAccountHolder,
      },
      where: { identificationNumber },
    });
  }
}

async function classifyWithdrawalRows(validRows: WithdrawImportRow[]) {
  const withdrawIds = [...new Set(validRows.map((row) => row.withdrawId))];
  if (withdrawIds.length === 0) {
    return {
      existingById: new Map<string, ExistingWithdrawRow>(),
      existingIds: new Set<string>(),
      insertRows: [] as WithdrawImportRow[],
      updateRows: [] as WithdrawImportRow[],
    };
  }

  const existing = await db.withdrawTransaction.findMany({
    where: { withdrawId: { in: withdrawIds } },
  });

  const existingById = new Map<string, ExistingWithdrawRow>(
    existing.map((row) => [row.withdrawId, row as ExistingWithdrawRow])
  );
  const existingIds = new Set(existingById.keys());
  const insertRows = validRows.filter((row) => !existingIds.has(row.withdrawId));
  const updateRows = validRows.filter((row) => existingIds.has(row.withdrawId));

  return { existingById, existingIds, insertRows, updateRows };
}

async function createWithdrawalRows(rows: WithdrawImportRow[]): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  await ensureCounterpartsExist(rows);

  const result = await db.withdrawTransaction.createMany({
    data: rows.map((row) => ({
      activityUrl: row.activityUrl,
      amount: toDecimal(row.amount),
      bankAccountHolder: row.bankAccountHolder,
      bankAccountNumber: row.bankAccountNumber,
      bankAccountType: row.bankAccountType,
      bankBranch: row.bankBranch,
      bankId: row.bankId,
      bankName: row.bankName,
      dateCreated: row.dateCreated,
      fee: toDecimal(row.fee),
      identificationNumber: row.identificationNumber,
      identificationType: row.identificationType,
      payoutDescription: row.payoutDescription,
      status: row.status,
      statusDetail: row.statusDetail,
      withdrawId: row.withdrawId,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

async function updateWithdrawalRows(rows: WithdrawImportRow[]): Promise<number> {
  let updated = 0;

  await ensureCounterpartsExist(rows);

  for (const row of rows) {
    await db.withdrawTransaction.update({
      where: { withdrawId: row.withdrawId },
      data: {
        activityUrl: row.activityUrl,
        amount: toDecimal(row.amount),
        bankAccountHolder: row.bankAccountHolder,
        bankAccountNumber: row.bankAccountNumber,
        bankAccountType: row.bankAccountType,
        bankBranch: row.bankBranch,
        bankId: row.bankId,
        bankName: row.bankName,
        dateCreated: row.dateCreated,
        fee: toDecimal(row.fee),
        identificationNumber: row.identificationNumber,
        identificationType: row.identificationType,
        payoutDescription: row.payoutDescription,
        status: row.status,
        statusDetail: row.statusDetail,
      },
    });
    updated += 1;
  }

  return updated;
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

// Mirrors normalizeAuditValue/auditValuesEqual in services/mercadopago/ingest.ts:
// compares string/number/null/Decimal (amount/fee) by normalized string form.
function normalizeWithdrawAuditValue(value: unknown): unknown {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value !== "object") {
    return value;
  }
  if (value.constructor?.name === "Decimal" && "toString" in value) {
    return String(value);
  }
  return value;
}

function withdrawAuditValuesEqual(a: unknown, b: unknown): boolean {
  return (
    JSON.stringify(normalizeWithdrawAuditValue(a)) ===
    JSON.stringify(normalizeWithdrawAuditValue(b))
  );
}

function buildWithdrawImportChanges(params: {
  existingById: Map<string, ExistingWithdrawRow>;
  syncLogId: bigint;
  updateRows: WithdrawImportRow[];
}): MpImportChangeInput[] {
  const changes: MpImportChangeInput[] = [];
  for (const newRow of params.updateRows) {
    const oldRow = params.existingById.get(newRow.withdrawId);
    if (!oldRow) {
      continue;
    }
    for (const fieldName of WITHDRAW_AUDIT_FIELDS) {
      const oldValue = oldRow[fieldName];
      const newValue = newRow[fieldName];
      if (withdrawAuditValuesEqual(oldValue, newValue)) {
        continue;
      }
      changes.push({
        fieldName,
        newValue: normalizeWithdrawAuditValue(newValue) as MpImportChangeInput["newValue"],
        oldValue: normalizeWithdrawAuditValue(oldValue) as MpImportChangeInput["oldValue"],
        reportType: "withdraw",
        sourceId: newRow.withdrawId,
        syncLogId: params.syncLogId,
      });
    }
  }
  return changes;
}

// ── Preview ─────────────────────────────────────────────────────────────────

export async function previewWithdrawals(input: {
  data: CsvUploadRow[];
  includeInsertRowIndexes?: boolean;
  includeUpdateRows?: boolean;
  mode?: CsvUploadMode;
}): Promise<WithdrawalPreview> {
  // `mode` is accepted for API symmetry but does not change the preview: the
  // original buildWithdrawalPreview resolved toSkip to errors.length for every
  // mode (insert-only/update-only/upsert), so we mirror that here.
  const { errors, validRows } = parseWithdrawalRows(input.data);
  const { insertRows, updateRows } = await classifyWithdrawalRows(validRows);

  return {
    errors: errors.length > 0 ? errors : undefined,
    insertRowIndexes: input.includeInsertRowIndexes
      ? insertRows.map((row) => row.rowIndex)
      : undefined,
    status: "ok",
    toInsert: insertRows.length,
    // Mirror the original: skip count is the error count regardless of mode.
    toSkip: errors.length,
    toUpdate: updateRows.length,
    updateRows: input.includeUpdateRows
      ? updateRows.map((row) => ({
          key: row.withdrawId,
          rowIndex: row.rowIndex,
          summary: summarizeWithdrawalRow(row),
        }))
      : undefined,
  };
}

// ── Import (single chunk) ─────────────────────────────────────────────────

async function importWithdrawalChunk(input: {
  data: CsvUploadRow[];
  mode?: CsvUploadMode;
  syncLogId?: bigint;
}) {
  const mode = input.mode ?? "insert-only";
  const { errors, validRows } = parseWithdrawalRows(input.data);
  const { existingById, insertRows, updateRows } = await classifyWithdrawalRows(validRows);

  let inserted = 0;
  let updated = 0;
  let skipped = errors.length;
  let changes: MpImportChangeInput[] = [];

  if (mode === "insert-only") {
    inserted = await createWithdrawalRows(insertRows);
    skipped += updateRows.length + (insertRows.length - inserted);
  } else if (mode === "update-only") {
    updated = await updateWithdrawalRows(updateRows);
    skipped += insertRows.length;
  } else {
    inserted = await createWithdrawalRows(insertRows);
    updated = await updateWithdrawalRows(updateRows);
    skipped += insertRows.length - inserted;
  }

  // Field-change audit only for rows actually written via update (not insert-only).
  if (input.syncLogId != null && mode !== "insert-only") {
    changes = buildWithdrawImportChanges({
      existingById,
      syncLogId: input.syncLogId,
      updateRows,
    });
  }

  return {
    changes,
    errors: errors.length > 0 ? errors : undefined,
    inserted,
    skipped,
    status: "ok" as const,
    toInsert: insertRows.length,
    toSkip: skipped,
    toUpdate: updateRows.length,
    updated,
  };
}

// ── Import (full pipeline: sync-log + chunking + audit) ─────────────────────

export async function importWithdrawals(input: {
  data: CsvUploadRow[];
  mode?: CsvUploadMode;
  userId: number | null;
}): Promise<WithdrawalImportResult> {
  const { validRows } = parseWithdrawalRows(input.data);
  const syncLogId = await createMpSyncLogEntry({
    triggerLabel: `withdraw:${validRows.length} filas`,
    triggerSource: "mp:csv-withdraw",
    triggerUserId: input.userId ?? null,
  });

  const chunks = chunkRows(input.data, UPSERT_CHUNK_SIZE);
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let toInsert = 0;
  let toUpdate = 0;
  let toSkip = 0;
  const errors: string[] = [];
  const changes: MpImportChangeInput[] = [];

  try {
    for (const chunk of chunks) {
      const result = await importWithdrawalChunk({
        data: chunk,
        mode: input.mode,
        syncLogId,
      });
      inserted += result.inserted;
      updated += result.updated;
      skipped += result.skipped;
      toInsert += result.toInsert;
      toUpdate += result.toUpdate;
      toSkip += result.toSkip;
      changes.push(...result.changes);
      if (result.errors) {
        errors.push(...result.errors);
      }
    }
  } catch (err) {
    await finalizeMpSyncLogEntry(syncLogId, {
      errorMessage: err instanceof Error ? err.message : String(err),
      inserted,
      skipped,
      status: "ERROR",
      updated,
    });
    throw err;
  }

  // Audit is fail-soft: a failure here must not fail the import.
  try {
    await insertMpImportChanges(changes);
  } catch (auditErr) {
    console.error("[Withdraw Import] audit failed, continuing:", auditErr);
  }

  const totalRows = input.data.length;
  const stats = {
    duplicateRows: 0,
    errorCount: errors.length,
    fieldChangeCount: changes.length,
    insertedRows: inserted,
    skippedRows: skipped,
    totalRows,
    unchangedRows: Math.max(toUpdate - updated, 0),
    updatedRows: updated,
    validRows: validRows.length,
  };

  await finalizeMpSyncLogEntry(syncLogId, {
    changeDetails: {
      fileName: null,
      importStats: stats,
      importStatsByType: { withdraw: stats },
      reportType: "withdraw",
      reportTypes: ["withdraw"],
      transactionId: null,
    },
    inserted,
    skipped,
    status: "SUCCESS",
    updated,
  });

  return {
    errors: errors.length > 0 ? errors : undefined,
    inserted,
    skipped,
    status: "ok" as const,
    toInsert,
    toSkip,
    toUpdate,
    updated,
  };
}
