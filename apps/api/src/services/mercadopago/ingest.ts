import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import { db } from "@finanzas/db";
import { sql } from "kysely";
import { checkMpConfig, MP_ACCESS_TOKEN, redactMpUrl } from "./client.ts";
import { isSettlementReport } from "./settlement-detector.ts";
import { mapRowToReleaseTransaction, mapRowToSettlementTransaction } from "./mappers.ts";
import {
  insertMpImportChanges,
  type MpImportChangeInput,
  type MpReportType,
} from "../mercadopago-sync.ts";

// Batch size for insertions
const BATCH_SIZE = 100;

/**
 * Parse a CSV line respecting quoted values that may contain commas
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      // Check if this is an escaped quote (two quotes in a row)
      if (nextChar === '"') {
        current += '"';
        i += 2; // Skip both quotes
        continue;
      }
      // Toggle quote mode
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (char === "," && !inQuotes) {
      // This is a field separator
      fields.push(current.trim());
      current = "";
      i++;
      continue;
    }

    // Regular character
    current += char;
    i++;
  }

  // Don't forget the last field
  if (current || fields.length > 0) {
    fields.push(current.trim());
  }

  return fields;
}

/**
 * Statistics returned after processing a MercadoPago report
 */
export interface ImportStats {
  totalRows: number;
  validRows: number;
  skippedRows: number;
  insertedRows: number;
  updatedRows: number;
  duplicateRows: number;
  fieldChangeCount: number;
  unchangedRows: number;
  errors: string[];
  processedSourceIds: string[];
  sourceUnavailable?: boolean;
}

type MpJsonDocumentGroup = {
  column?: unknown;
  records?: unknown;
};

type MpJsonReportPayload = {
  document?: {
    views?: unknown;
  };
};

type ProcessReportOptions = {
  syncLogId?: bigint;
};

/**
 * Downloads and processes a CSV report from a URL.
 * Returns detailed statistics about the import.
 */

export async function processReportUrl(
  url: string,
  reportType: string,
  options: ProcessReportOptions = {}
): Promise<ImportStats> {
  const processedSourceIdSet = new Set<string>();
  const stats: ImportStats = {
    totalRows: 0,
    validRows: 0,
    skippedRows: 0,
    insertedRows: 0,
    updatedRows: 0,
    duplicateRows: 0,
    fieldChangeCount: 0,
    unchangedRows: 0,
    errors: [],
    processedSourceIds: [],
    sourceUnavailable: false,
  };

  try {
    checkMpConfig();
    console.log(`[MP Ingest] Downloading report from ${redactMpUrl(url)}`);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });

    // Handle 404 gracefully - report doesn't exist yet
    if (res.status === 404) {
      console.log(`[MP Ingest] Report not found (404): ${url}`);
      stats.sourceUnavailable = true;
      return stats; // Return empty stats - nothing to process
    }

    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} - ${res.statusText}`);
    }
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();

    const isFirstRow = { value: true };
    const batchState: BatchState = {
      batch: [],
      flushPromise: Promise.resolve(),
    };

    const flushBatch = async () => {
      if (batchState.batch.length === 0) {
        return;
      }
      const result = await upsertBatch(reportType, batchState.batch, options);
      stats.insertedRows += result.inserted;
      stats.updatedRows += result.updated;
      stats.unchangedRows += result.unchanged;
      stats.duplicateRows += result.unchanged;
      stats.fieldChangeCount += result.fieldChangeCount;
      batchState.batch = [];
    };

    if (contentType.includes("application/json")) {
      const payload = (await res.json()) as MpJsonReportPayload;
      await processMpJsonPayload(
        payload,
        reportType,
        stats,
        batchState,
        flushBatch,
        isFirstRow,
        processedSourceIdSet
      );
    } else {
      const body = res.body;
      if (!body) {
        throw new Error("Empty response body");
      }

      // Convert Web Stream to Node Stream
      const nodeStream = Readable.fromWeb(body as ReadableStream);

      await processCsvStream(
        nodeStream,
        reportType,
        stats,
        batchState,
        flushBatch,
        isFirstRow,
        processedSourceIdSet
      );
    }
  } catch (e) {
    console.error(`[MP Webhook] Failed to process report ${url}:`, e);
    stats.errors.push(e instanceof Error ? e.message : String(e));
    throw e;
  }

  stats.processedSourceIds = Array.from(processedSourceIdSet);
  return stats;
}

async function processCsvStream(
  nodeStream: Readable,
  reportType: string,
  stats: ImportStats,
  batchState: BatchState,
  flushBatch: () => Promise<void>,
  isFirstRow: { value: boolean },
  processedSourceIdSet: Set<string>
) {
  await new Promise<void>((resolve, reject) => {
    // Use readline to process CSV line by line with proper quote handling
    let headerMap: Record<number, string> | null = null;
    const rl = createInterface({
      input: nodeStream,
      crlfDelay: Number.POSITIVE_INFINITY,
    });

    rl.on("line", (line: string) => {
      try {
        // Parse line using our custom CSV parser that respects quotes
        const row = parseCSVLine(line);
        handleCsvData(
          row,
          headerMap,
          (map) => {
            headerMap = map;
          },
          reportType,
          stats,
          batchState,
          flushBatch,
          nodeStream,
          reject,
          isFirstRow,
          processedSourceIdSet
        );
      } catch (err) {
        reject(err);
      }
    });

    rl.on("close", async () => {
      try {
        await batchState.flushPromise;
        await flushBatch();
        console.log(`[MP Ingest] Finished processing CSV for ${reportType}. Stats:`, stats);
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    rl.on("error", (err: Error) => {
      console.error("[MP Ingest] Readline error:", err);
      reject(err);
    });
  });
}

type ReleaseInput = ReturnType<typeof mapRowToReleaseTransaction>;
type SettlementInput = ReturnType<typeof mapRowToSettlementTransaction>;
type ReportRowInput = ReleaseInput | SettlementInput;

type UpsertBatchResult = {
  fieldChangeCount: number;
  inserted: number;
  unchanged: number;
  updated: number;
};

type UpsertReturnedRow = {
  inserted: boolean;
  sourceId: string;
};

type ExistingReportRow = Record<string, unknown> & {
  sourceId: string;
};

type BatchState = {
  batch: ReportRowInput[];
  flushPromise: Promise<void>;
};

const convertRowArrayToObject = (
  row: string[] | Record<string, string | undefined>,
  headerMap: Record<number, string>
): Record<string, string | undefined> => {
  // Use our custom CSV parser for better quote handling if we detect issues
  const arrayRow = Array.isArray(row) ? row : Object.values(row);
  const objectRow: Record<string, string | undefined> = {};

  // Debug: Log column count mismatch
  const headerCount = Object.keys(headerMap).length;
  if (arrayRow.length !== headerCount) {
    console.warn(
      `[MP Ingest] Column count mismatch: headerMap has ${headerCount} cols, row has ${arrayRow.length} cols`
    );
    // If row has more columns than headers, it's likely due to quotes being split
    // Log the extra columns for debugging
    if (arrayRow.length > headerCount) {
      const extraCols = arrayRow.slice(headerCount);
      console.warn(`[MP Ingest] Extra columns: ${extraCols.slice(0, 3).join(" | ")}`);
    }
  }

  for (let i = 0; i < arrayRow.length; i++) {
    const key = headerMap[i];
    const val = arrayRow[i];
    if (key && typeof val === "string") {
      objectRow[key] = val;
    } else if (!key && i < 5) {
      // Log missing headers only for first few columns
      console.warn(`[MP Ingest] Missing header for column ${i}, value: "${val}"`);
    }
  }
  return objectRow;
};

const createHeaderMap = (
  row: string[] | Record<string, string | undefined>
): Record<number, string> => {
  const headerRow = Array.isArray(row) ? row : Object.keys(row);
  const map = Object.fromEntries(
    headerRow.map((h, i) => [i, typeof h === "string" ? h.trim() : String(h)])
  );
  console.log(`[MP Ingest] Created header map with ${Object.keys(map).length} columns`);
  return map;
};

const handleCsvData = (
  row: string[] | Record<string, string | undefined>,
  headerMap: Record<number, string> | null,
  setHeaderMap: (map: Record<number, string>) => void,
  reportType: string,
  stats: ImportStats,
  batchState: BatchState,
  flushBatch: () => Promise<void>,
  nodeStream: Readable,
  reject: (reason?: unknown) => void,
  isFirstRow: { value: boolean },
  processedSourceIdSet: Set<string>
): boolean => {
  // First row is the header - create a mapping
  if (!headerMap) {
    setHeaderMap(createHeaderMap(row));
    return true; // Skip header row
  }

  // Convert array to object and handle the row
  const objectRow = convertRowArrayToObject(row, headerMap);
  handleCsvRow(
    objectRow,
    reportType,
    stats,
    batchState,
    flushBatch,
    nodeStream,
    reject,
    isFirstRow,
    processedSourceIdSet
  );
  return false;
};

const cleanCsvRow = (row: Record<string, string | undefined>) => {
  const cleanRow: Record<string, string | undefined> = {};
  for (const key in row) {
    const cleanKey = key.trim();
    cleanRow[cleanKey] = row[key]?.trim?.() ?? row[key];
  }
  return cleanRow;
};

const mapReportRow = (reportType: string, row: Record<string, string | undefined>) => {
  try {
    const record = isSettlementReport(reportType)
      ? mapRowToSettlementTransaction(row)
      : mapRowToReleaseTransaction(row);
    return record.sourceId ? record : null;
  } catch (err) {
    // Log the row data that caused the error (first 10 keys for readability)
    const sampleKeys = Object.keys(row).slice(0, 10);
    const sampleData = Object.fromEntries(
      sampleKeys.map((k) => [k, row[k]?.substring?.(0, 50) || row[k]])
    );
    console.error(
      `[mapReportRow] Error mapping row with keys ${Object.keys(row).length}, sample data:`,
      sampleData
    );
    throw err;
  }
};

const logFirstRow = (
  cleanRow: Record<string, string | undefined>,
  isFirstRow: { value: boolean }
) => {
  if (!isFirstRow.value) {
    return;
  }
  console.log("[MP Ingest] First row keys:", Object.keys(cleanRow));
  console.log("[MP Ingest] First row SOURCE_ID:", cleanRow.SOURCE_ID);
  isFirstRow.value = false;
};

const enqueueBatchRecord = async (
  record: ReportRowInput,
  batchState: BatchState,
  stats: ImportStats,
  flushBatch: () => Promise<void>,
  nodeStream: Readable,
  reject: (reason?: unknown) => void
) => {
  batchState.batch.push(record);
  stats.validRows += 1;

  if (batchState.batch.length < BATCH_SIZE) {
    return;
  }

  nodeStream.pause();
  batchState.flushPromise = batchState.flushPromise
    .then(async () => {
      await flushBatch();
    })
    .then(() => {
      nodeStream.resume();
    })
    .catch((err) => {
      reject(err);
    });
};

const handleCsvRow = (
  row: Record<string, string | undefined>,
  reportType: string,
  stats: ImportStats,
  batchState: BatchState,
  flushBatch: () => Promise<void>,
  nodeStream: Readable,
  reject: (reason?: unknown) => void,
  isFirstRow: { value: boolean },
  processedSourceIdSet: Set<string>
) => {
  stats.totalRows += 1;
  const cleanRow = cleanCsvRow(row);
  logFirstRow(cleanRow, isFirstRow);

  try {
    const record = mapReportRow(reportType, cleanRow);
    if (!record) {
      stats.skippedRows += 1;
      return;
    }
    if (record.sourceId?.trim()) {
      processedSourceIdSet.add(record.sourceId.trim());
    }
    void enqueueBatchRecord(record, batchState, stats, flushBatch, nodeStream, reject);
  } catch (err) {
    stats.errors.push(
      `Row ${stats.totalRows}: ${err instanceof Error ? err.message : String(err)}`
    );
    stats.skippedRows += 1;
  }
};

function normalizeJsonCellValue(raw: unknown): string | undefined {
  if (raw == null) {
    return undefined;
  }

  const value = String(raw).trim();
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/""/g, '"');
  }
  return value;
}

function extractRowsFromJsonPayload(
  payload: MpJsonReportPayload
): Record<string, string | undefined>[] {
  const views = payload.document?.views;
  if (!Array.isArray(views)) {
    return [];
  }

  const rows: Record<string, string | undefined>[] = [];

  for (const view of views) {
    if (!view || typeof view !== "object") {
      continue;
    }

    for (const group of Object.values(view as Record<string, MpJsonDocumentGroup>)) {
      const columns = group?.column;
      const records = group?.records;
      if (!Array.isArray(columns) || !Array.isArray(records)) {
        continue;
      }

      for (const record of records) {
        if (!Array.isArray(record)) {
          continue;
        }

        const row: Record<string, string | undefined> = {};
        for (let i = 0; i < columns.length; i++) {
          const keyRaw = columns[i];
          const key = typeof keyRaw === "string" ? keyRaw.trim() : String(keyRaw ?? "").trim();
          if (!key) {
            continue;
          }
          row[key] = normalizeJsonCellValue(record[i]);
        }
        rows.push(row);
      }
    }
  }

  return rows;
}

async function processMpJsonPayload(
  payload: MpJsonReportPayload,
  reportType: string,
  stats: ImportStats,
  batchState: BatchState,
  flushBatch: () => Promise<void>,
  isFirstRow: { value: boolean },
  processedSourceIdSet: Set<string>
) {
  const rows = extractRowsFromJsonPayload(payload);
  console.log(`[MP Ingest] JSON payload detected for ${reportType}. Rows: ${rows.length}`);

  for (const row of rows) {
    stats.totalRows += 1;
    const cleanRow = cleanCsvRow(row);
    logFirstRow(cleanRow, isFirstRow);

    try {
      const record = mapReportRow(reportType, cleanRow);
      if (!record) {
        stats.skippedRows += 1;
        continue;
      }
      if (record.sourceId?.trim()) {
        processedSourceIdSet.add(record.sourceId.trim());
      }

      batchState.batch.push(record);
      stats.validRows += 1;

      if (batchState.batch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    } catch (err) {
      stats.errors.push(
        `Row ${stats.totalRows}: ${err instanceof Error ? err.message : String(err)}`
      );
      stats.skippedRows += 1;
    }
  }

  await flushBatch();
  console.log(`[MP Ingest] Finished processing JSON for ${reportType}. Stats:`, stats);
}

const RELEASE_UPDATE_COLUMNS = [
  "identificationNumber",
  "date",
  "externalReference",
  "recordType",
  "description",
  "netCreditAmount",
  "netDebitAmount",
  "grossAmount",
  "sellerAmount",
  "mpFeeAmount",
  "financingFeeAmount",
  "shippingFeeAmount",
  "taxesAmount",
  "couponAmount",
  "effectiveCouponAmount",
  "balanceAmount",
  "taxAmountTelco",
  "installments",
  "paymentMethod",
  "paymentMethodType",
  "taxDetail",
  "taxesDisaggregated",
  "transactionApprovalDate",
  "transactionIntentId",
  "posId",
  "posName",
  "externalPosId",
  "storeId",
  "storeName",
  "externalStoreId",
  "currency",
  "shippingId",
  "shipmentMode",
  "shippingOrderId",
  "orderId",
  "packId",
  "poiId",
  "itemId",
  "metadata",
  "cardInitialNumber",
  "operationTags",
  "lastFourDigits",
  "franchise",
  "issuerName",
  "poiBankName",
  "poiWalletName",
  "businessUnit",
  "subUnit",
  "payoutBankAccountNumber",
  "productSku",
  "saleDetail",
  "orderMp",
  "purchaseId",
  "isReleased",
  "countryIssuer",
  "merchantCategoryCode",
  "cardEntryMode",
  "authorizationCode",
  "applicationId",
  "segmentDetail",
  "dateShort",
  "transactionApprovalDateShort",
] as const;

const SETTLEMENT_UPDATE_COLUMNS = [
  "identificationNumber",
  "transactionDate",
  "settlementDate",
  "moneyReleaseDate",
  "externalReference",
  "userId",
  "paymentMethodType",
  "paymentMethod",
  "site",
  "transactionType",
  "transactionAmount",
  "transactionCurrency",
  "sellerAmount",
  "feeAmount",
  "settlementNetAmount",
  "settlementCurrency",
  "realAmount",
  "couponAmount",
  "metadata",
  "mkpFeeAmount",
  "financingFeeAmount",
  "shippingFeeAmount",
  "taxesAmount",
  "installments",
  "taxDetail",
  "taxesDisaggregated",
  "description",
  "cardInitialNumber",
  "operationTags",
  "businessUnit",
  "subUnit",
  "productSku",
  "saleDetail",
  "transactionIntentId",
  "franchise",
  "issuerName",
  "lastFourDigits",
  "orderMp",
  "invoicingPeriod",
  "payBankTransferId",
  "isReleased",
  "tipAmount",
  "purchaseId",
  "totalCouponAmount",
  "posId",
  "posName",
  "externalPosId",
  "storeId",
  "storeName",
  "externalStoreId",
  "poiId",
  "orderId",
  "shippingId",
  "shipmentMode",
  "packId",
  "shippingOrderId",
  "poiWalletName",
  "poiBankName",
  "merchantCategoryCode",
  "applicationId",
  "segmentDetail",
  "authorizationCode",
  "cardEntryMode",
  "authenticatedPayer",
  "transactionDateShort",
  "settlementDateShort",
  "moneyReleaseDateShort",
] as const;

function dedupeRowsBySourceId<T extends ReportRowInput>(rows: T[]) {
  const bySourceId = new Map<string, T>();
  for (const row of rows) {
    bySourceId.set(row.sourceId.trim(), row);
  }
  return Array.from(bySourceId.values());
}

function toDbColumnName(column: string) {
  return column.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function excludedColumnRef(column: string) {
  return `excluded.${toDbColumnName(column)}` as never;
}

// In an ON CONFLICT DO UPDATE ... WHERE clause both the target table and the
// `excluded` pseudo-relation are in scope, so an UNQUALIFIED column that exists
// in both (e.g. identification_number) raises Postgres 42702 "column reference
// is ambiguous". Qualify the existing-row side with the physical target table
// name. Physical (snake_case) names match excludedColumnRef and bypass $qb's
// model→column mapping the same way.
function targetColumnRef(table: string, column: string) {
  return `${table}.${toDbColumnName(column)}` as never;
}

function countUpsertResults(returnedRows: UpsertReturnedRow[], inputRows: number) {
  const inserted = returnedRows.filter((row) => row.inserted).length;
  const updated = returnedRows.length - inserted;
  return {
    inserted,
    updated,
    unchanged: Math.max(inputRows - returnedRows.length, 0),
  };
}

async function upsertBatch(
  reportType: string,
  rows: ReportRowInput[],
  options: ProcessReportOptions
): Promise<UpsertBatchResult> {
  if (rows.length === 0) {
    return { fieldChangeCount: 0, inserted: 0, unchanged: 0, updated: 0 };
  }

  if (isSettlementReport(reportType)) {
    return upsertSettlementBatch(rows as SettlementInput[], options);
  }

  return upsertReleaseBatch(rows as ReleaseInput[], options);
}

async function selectExistingReleaseRows(sourceIds: string[]) {
  if (sourceIds.length === 0) {
    return new Map<string, ExistingReportRow>();
  }
  const rows = (await db.$qb
    .selectFrom("ReleaseTransaction")
    .selectAll()
    .where("sourceId", "in", sourceIds)
    .execute()) as ExistingReportRow[];
  return new Map(rows.map((row) => [row.sourceId, row]));
}

async function selectExistingSettlementRows(sourceIds: string[]) {
  if (sourceIds.length === 0) {
    return new Map<string, ExistingReportRow>();
  }
  const rows = (await db.$qb
    .selectFrom("SettlementTransaction")
    .selectAll()
    .where("sourceId", "in", sourceIds)
    .execute()) as ExistingReportRow[];
  return new Map(rows.map((row) => [row.sourceId, row]));
}

function normalizeAuditValue(value: unknown): unknown {
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
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAuditValue(item));
  }

  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    normalized[key] = normalizeAuditValue((value as Record<string, unknown>)[key]);
  }
  return normalized;
}

function auditValuesEqual(a: unknown, b: unknown) {
  return JSON.stringify(normalizeAuditValue(a)) === JSON.stringify(normalizeAuditValue(b));
}

function buildImportChanges(params: {
  fields: readonly string[];
  newRowsBySourceId: Map<string, ReportRowInput>;
  oldRowsBySourceId: Map<string, ExistingReportRow>;
  reportType: MpReportType;
  syncLogId: bigint;
  updatedSourceIds: Set<string>;
}) {
  const changes: MpImportChangeInput[] = [];
  for (const sourceId of params.updatedSourceIds) {
    const oldRow = params.oldRowsBySourceId.get(sourceId);
    const newRow = params.newRowsBySourceId.get(sourceId);
    if (!oldRow || !newRow) {
      continue;
    }
    for (const fieldName of params.fields) {
      const oldValue = normalizeAuditValue(oldRow[fieldName]);
      const newValue = normalizeAuditValue((newRow as Record<string, unknown>)[fieldName]);
      if (auditValuesEqual(oldValue, newValue)) {
        continue;
      }
      changes.push({
        fieldName,
        newValue: newValue as never,
        oldValue: oldValue as never,
        reportType: params.reportType,
        sourceId,
        syncLogId: params.syncLogId,
      });
    }
  }
  return changes;
}

async function persistImportChanges(params: {
  fields: readonly string[];
  newRowsBySourceId: Map<string, ReportRowInput>;
  oldRowsBySourceId: Map<string, ExistingReportRow>;
  reportType: MpReportType;
  syncLogId?: bigint;
  updatedSourceIds: Set<string>;
}) {
  if (!params.syncLogId || params.updatedSourceIds.size === 0) {
    return 0;
  }

  const changes = buildImportChanges({
    fields: params.fields,
    newRowsBySourceId: params.newRowsBySourceId,
    oldRowsBySourceId: params.oldRowsBySourceId,
    reportType: params.reportType,
    syncLogId: params.syncLogId,
    updatedSourceIds: params.updatedSourceIds,
  });
  return insertMpImportChanges(changes);
}

async function upsertReleaseBatch(
  rows: ReleaseInput[],
  options: ProcessReportOptions
): Promise<UpsertBatchResult> {
  const uniqueRows = dedupeRowsBySourceId(rows);
  const newRowsBySourceId = new Map<string, ReportRowInput>(
    uniqueRows.map((row) => [row.sourceId.trim(), row])
  );
  const oldRowsBySourceId = options.syncLogId
    ? await selectExistingReleaseRows(Array.from(newRowsBySourceId.keys()))
    : new Map<string, ExistingReportRow>();
  const updatedAt = new Date().toISOString();
  const returnedRows = await db.$qb
    .insertInto("ReleaseTransaction")
    .values(uniqueRows as never)
    .onConflict((oc) =>
      oc
        .column("sourceId")
        .doUpdateSet(({ ref }) => ({
          identificationNumber: ref(excludedColumnRef("identificationNumber")),
          date: ref(excludedColumnRef("date")),
          externalReference: ref(excludedColumnRef("externalReference")),
          recordType: ref(excludedColumnRef("recordType")),
          description: ref(excludedColumnRef("description")),
          netCreditAmount: ref(excludedColumnRef("netCreditAmount")),
          netDebitAmount: ref(excludedColumnRef("netDebitAmount")),
          grossAmount: ref(excludedColumnRef("grossAmount")),
          sellerAmount: ref(excludedColumnRef("sellerAmount")),
          mpFeeAmount: ref(excludedColumnRef("mpFeeAmount")),
          financingFeeAmount: ref(excludedColumnRef("financingFeeAmount")),
          shippingFeeAmount: ref(excludedColumnRef("shippingFeeAmount")),
          taxesAmount: ref(excludedColumnRef("taxesAmount")),
          couponAmount: ref(excludedColumnRef("couponAmount")),
          effectiveCouponAmount: ref(excludedColumnRef("effectiveCouponAmount")),
          balanceAmount: ref(excludedColumnRef("balanceAmount")),
          taxAmountTelco: ref(excludedColumnRef("taxAmountTelco")),
          installments: ref(excludedColumnRef("installments")),
          paymentMethod: ref(excludedColumnRef("paymentMethod")),
          paymentMethodType: ref(excludedColumnRef("paymentMethodType")),
          taxDetail: ref(excludedColumnRef("taxDetail")),
          taxesDisaggregated: ref(excludedColumnRef("taxesDisaggregated")),
          transactionApprovalDate: ref(excludedColumnRef("transactionApprovalDate")),
          transactionIntentId: ref(excludedColumnRef("transactionIntentId")),
          posId: ref(excludedColumnRef("posId")),
          posName: ref(excludedColumnRef("posName")),
          externalPosId: ref(excludedColumnRef("externalPosId")),
          storeId: ref(excludedColumnRef("storeId")),
          storeName: ref(excludedColumnRef("storeName")),
          externalStoreId: ref(excludedColumnRef("externalStoreId")),
          currency: ref(excludedColumnRef("currency")),
          shippingId: ref(excludedColumnRef("shippingId")),
          shipmentMode: ref(excludedColumnRef("shipmentMode")),
          shippingOrderId: ref(excludedColumnRef("shippingOrderId")),
          orderId: ref(excludedColumnRef("orderId")),
          packId: ref(excludedColumnRef("packId")),
          poiId: ref(excludedColumnRef("poiId")),
          itemId: ref(excludedColumnRef("itemId")),
          metadata: ref(excludedColumnRef("metadata")),
          cardInitialNumber: ref(excludedColumnRef("cardInitialNumber")),
          operationTags: ref(excludedColumnRef("operationTags")),
          lastFourDigits: ref(excludedColumnRef("lastFourDigits")),
          franchise: ref(excludedColumnRef("franchise")),
          issuerName: ref(excludedColumnRef("issuerName")),
          poiBankName: ref(excludedColumnRef("poiBankName")),
          poiWalletName: ref(excludedColumnRef("poiWalletName")),
          businessUnit: ref(excludedColumnRef("businessUnit")),
          subUnit: ref(excludedColumnRef("subUnit")),
          payoutBankAccountNumber: ref(excludedColumnRef("payoutBankAccountNumber")),
          productSku: ref(excludedColumnRef("productSku")),
          saleDetail: ref(excludedColumnRef("saleDetail")),
          orderMp: ref(excludedColumnRef("orderMp")),
          purchaseId: ref(excludedColumnRef("purchaseId")),
          isReleased: ref(excludedColumnRef("isReleased")),
          countryIssuer: ref(excludedColumnRef("countryIssuer")),
          merchantCategoryCode: ref(excludedColumnRef("merchantCategoryCode")),
          cardEntryMode: ref(excludedColumnRef("cardEntryMode")),
          authorizationCode: ref(excludedColumnRef("authorizationCode")),
          applicationId: ref(excludedColumnRef("applicationId")),
          segmentDetail: ref(excludedColumnRef("segmentDetail")),
          dateShort: ref(excludedColumnRef("dateShort")),
          transactionApprovalDateShort: ref(excludedColumnRef("transactionApprovalDateShort")),
          updatedAt,
        }))
        .where((eb) =>
          eb.or(
            RELEASE_UPDATE_COLUMNS.map((column) =>
              eb(
                eb.ref(targetColumnRef("release_transactions", column)),
                "is distinct from",
                eb.ref(excludedColumnRef(column))
              )
            )
          )
        )
    )
    .returning(["sourceId"])
    .returning(sql<boolean>`xmax = 0`.as("inserted"))
    .execute();

  const updatedSourceIds = new Set(
    returnedRows.filter((row) => !row.inserted).map((row) => row.sourceId)
  );
  const fieldChangeCount = await persistImportChanges({
    fields: RELEASE_UPDATE_COLUMNS,
    newRowsBySourceId,
    oldRowsBySourceId,
    reportType: "release",
    syncLogId: options.syncLogId,
    updatedSourceIds,
  });

  return { ...countUpsertResults(returnedRows, rows.length), fieldChangeCount };
}

async function upsertSettlementBatch(
  rows: SettlementInput[],
  options: ProcessReportOptions
): Promise<UpsertBatchResult> {
  const uniqueRows = dedupeRowsBySourceId(rows);
  const newRowsBySourceId = new Map<string, ReportRowInput>(
    uniqueRows.map((row) => [row.sourceId.trim(), row])
  );
  const oldRowsBySourceId = options.syncLogId
    ? await selectExistingSettlementRows(Array.from(newRowsBySourceId.keys()))
    : new Map<string, ExistingReportRow>();
  const updatedAt = new Date().toISOString();
  const returnedRows = await db.$qb
    .insertInto("SettlementTransaction")
    .values(uniqueRows as never)
    .onConflict((oc) =>
      oc
        .column("sourceId")
        .doUpdateSet(({ ref }) => ({
          identificationNumber: ref(excludedColumnRef("identificationNumber")),
          transactionDate: ref(excludedColumnRef("transactionDate")),
          settlementDate: ref(excludedColumnRef("settlementDate")),
          moneyReleaseDate: ref(excludedColumnRef("moneyReleaseDate")),
          externalReference: ref(excludedColumnRef("externalReference")),
          userId: ref(excludedColumnRef("userId")),
          paymentMethodType: ref(excludedColumnRef("paymentMethodType")),
          paymentMethod: ref(excludedColumnRef("paymentMethod")),
          site: ref(excludedColumnRef("site")),
          transactionType: ref(excludedColumnRef("transactionType")),
          transactionAmount: ref(excludedColumnRef("transactionAmount")),
          transactionCurrency: ref(excludedColumnRef("transactionCurrency")),
          sellerAmount: ref(excludedColumnRef("sellerAmount")),
          feeAmount: ref(excludedColumnRef("feeAmount")),
          settlementNetAmount: ref(excludedColumnRef("settlementNetAmount")),
          settlementCurrency: ref(excludedColumnRef("settlementCurrency")),
          realAmount: ref(excludedColumnRef("realAmount")),
          couponAmount: ref(excludedColumnRef("couponAmount")),
          metadata: ref(excludedColumnRef("metadata")),
          mkpFeeAmount: ref(excludedColumnRef("mkpFeeAmount")),
          financingFeeAmount: ref(excludedColumnRef("financingFeeAmount")),
          shippingFeeAmount: ref(excludedColumnRef("shippingFeeAmount")),
          taxesAmount: ref(excludedColumnRef("taxesAmount")),
          installments: ref(excludedColumnRef("installments")),
          taxDetail: ref(excludedColumnRef("taxDetail")),
          taxesDisaggregated: ref(excludedColumnRef("taxesDisaggregated")),
          description: ref(excludedColumnRef("description")),
          cardInitialNumber: ref(excludedColumnRef("cardInitialNumber")),
          operationTags: ref(excludedColumnRef("operationTags")),
          businessUnit: ref(excludedColumnRef("businessUnit")),
          subUnit: ref(excludedColumnRef("subUnit")),
          productSku: ref(excludedColumnRef("productSku")),
          saleDetail: ref(excludedColumnRef("saleDetail")),
          transactionIntentId: ref(excludedColumnRef("transactionIntentId")),
          franchise: ref(excludedColumnRef("franchise")),
          issuerName: ref(excludedColumnRef("issuerName")),
          lastFourDigits: ref(excludedColumnRef("lastFourDigits")),
          orderMp: ref(excludedColumnRef("orderMp")),
          invoicingPeriod: ref(excludedColumnRef("invoicingPeriod")),
          payBankTransferId: ref(excludedColumnRef("payBankTransferId")),
          isReleased: ref(excludedColumnRef("isReleased")),
          tipAmount: ref(excludedColumnRef("tipAmount")),
          purchaseId: ref(excludedColumnRef("purchaseId")),
          totalCouponAmount: ref(excludedColumnRef("totalCouponAmount")),
          posId: ref(excludedColumnRef("posId")),
          posName: ref(excludedColumnRef("posName")),
          externalPosId: ref(excludedColumnRef("externalPosId")),
          storeId: ref(excludedColumnRef("storeId")),
          storeName: ref(excludedColumnRef("storeName")),
          externalStoreId: ref(excludedColumnRef("externalStoreId")),
          poiId: ref(excludedColumnRef("poiId")),
          orderId: ref(excludedColumnRef("orderId")),
          shippingId: ref(excludedColumnRef("shippingId")),
          shipmentMode: ref(excludedColumnRef("shipmentMode")),
          packId: ref(excludedColumnRef("packId")),
          shippingOrderId: ref(excludedColumnRef("shippingOrderId")),
          poiWalletName: ref(excludedColumnRef("poiWalletName")),
          poiBankName: ref(excludedColumnRef("poiBankName")),
          merchantCategoryCode: ref(excludedColumnRef("merchantCategoryCode")),
          applicationId: ref(excludedColumnRef("applicationId")),
          segmentDetail: ref(excludedColumnRef("segmentDetail")),
          authorizationCode: ref(excludedColumnRef("authorizationCode")),
          cardEntryMode: ref(excludedColumnRef("cardEntryMode")),
          authenticatedPayer: ref(excludedColumnRef("authenticatedPayer")),
          transactionDateShort: ref(excludedColumnRef("transactionDateShort")),
          settlementDateShort: ref(excludedColumnRef("settlementDateShort")),
          moneyReleaseDateShort: ref(excludedColumnRef("moneyReleaseDateShort")),
          updatedAt,
        }))
        .where((eb) =>
          eb.or(
            SETTLEMENT_UPDATE_COLUMNS.map((column) =>
              eb(
                eb.ref(targetColumnRef("settlement_transactions", column)),
                "is distinct from",
                eb.ref(excludedColumnRef(column))
              )
            )
          )
        )
    )
    .returning(["sourceId"])
    .returning(sql<boolean>`xmax = 0`.as("inserted"))
    .execute();

  const updatedSourceIds = new Set(
    returnedRows.filter((row) => !row.inserted).map((row) => row.sourceId)
  );
  const fieldChangeCount = await persistImportChanges({
    fields: SETTLEMENT_UPDATE_COLUMNS,
    newRowsBySourceId,
    oldRowsBySourceId,
    reportType: "settlement",
    syncLogId: options.syncLogId,
    updatedSourceIds,
  });

  return { ...countUpsertResults(returnedRows, rows.length), fieldChangeCount };
}
