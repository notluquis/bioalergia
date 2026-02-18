import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { db } from "@finanzas/db";
import { checkMpConfig, MP_ACCESS_TOKEN } from "./client";
import { mapRowToReleaseTransaction, mapRowToSettlementTransaction } from "./mappers";

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
  duplicateRows: number;
  errors: string[];
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

/**
 * Downloads and processes a CSV report from a URL.
 * Returns detailed statistics about the import.
 */

export async function processReportUrl(url: string, reportType: string): Promise<ImportStats> {
  const stats: ImportStats = {
    totalRows: 0,
    validRows: 0,
    skippedRows: 0,
    insertedRows: 0,
    duplicateRows: 0,
    errors: [],
  };

  try {
    checkMpConfig();
    console.log(`[MP Ingest] Downloading report from ${url}`);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });

    // Handle 404 gracefully - report doesn't exist yet
    if (res.status === 404) {
      console.log(`[MP Ingest] Report not found (404): ${url}`);
      return stats; // Return empty stats - nothing to process
    }

    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} - ${res.statusText}`);
    }
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();

    const isFirstRow = { value: true };
    const batchState: BatchState = {
      batch: [],
      batchValid: 0,
      flushPromise: Promise.resolve(),
    };

    const flushBatch = async () => {
      if (batchState.batch.length === 0) {
        return;
      }
      const inserted = await insertBatch(reportType, batchState.batch);
      stats.insertedRows += inserted;
      stats.duplicateRows += Math.max(batchState.batchValid - inserted, 0);
      batchState.batch = [];
      batchState.batchValid = 0;
    };

    if (contentType.includes("application/json")) {
      const payload = (await res.json()) as MpJsonReportPayload;
      await processMpJsonPayload(payload, reportType, stats, batchState, flushBatch, isFirstRow);
    } else {
      const body = res.body;
      if (!body) {
        throw new Error("Empty response body");
      }

      // Convert Web Stream to Node Stream
      const nodeStream = Readable.fromWeb(body as import("stream/web").ReadableStream);

      await processCsvStream(nodeStream, reportType, stats, batchState, flushBatch, isFirstRow);
    }
  } catch (e) {
    console.error(`[MP Webhook] Failed to process report ${url}:`, e);
    stats.errors.push(e instanceof Error ? e.message : String(e));
    throw e;
  }

  return stats;
}

async function processCsvStream(
  nodeStream: Readable,
  reportType: string,
  stats: ImportStats,
  batchState: BatchState,
  flushBatch: () => Promise<void>,
  isFirstRow: { value: boolean },
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

type BatchState = {
  batch: ReportRowInput[];
  batchValid: number;
  flushPromise: Promise<void>;
};

const convertRowArrayToObject = (
  row: string[] | Record<string, string | undefined>,
  headerMap: Record<number, string>,
): Record<string, string | undefined> => {
  // Use our custom CSV parser for better quote handling if we detect issues
  const arrayRow = Array.isArray(row) ? row : Object.values(row);
  const objectRow: Record<string, string | undefined> = {};

  // Debug: Log column count mismatch
  const headerCount = Object.keys(headerMap).length;
  if (arrayRow.length !== headerCount) {
    console.warn(
      `[MP Ingest] Column count mismatch: headerMap has ${headerCount} cols, row has ${arrayRow.length} cols`,
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
  row: string[] | Record<string, string | undefined>,
): Record<number, string> => {
  const headerRow = Array.isArray(row) ? row : Object.keys(row);
  const map = Object.fromEntries(
    headerRow.map((h, i) => [i, typeof h === "string" ? h.trim() : String(h)]),
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
    const record = reportType.toLowerCase().includes("settlement")
      ? mapRowToSettlementTransaction(row)
      : mapRowToReleaseTransaction(row);
    return record.sourceId ? record : null;
  } catch (err) {
    // Log the row data that caused the error (first 10 keys for readability)
    const sampleKeys = Object.keys(row).slice(0, 10);
    const sampleData = Object.fromEntries(
      sampleKeys.map((k) => [k, row[k]?.substring?.(0, 50) || row[k]]),
    );
    console.error(
      `[mapReportRow] Error mapping row with keys ${Object.keys(row).length}, sample data:`,
      sampleData,
    );
    throw err;
  }
};

const logFirstRow = (
  cleanRow: Record<string, string | undefined>,
  isFirstRow: { value: boolean },
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
  reject: (reason?: unknown) => void,
) => {
  batchState.batch.push(record);
  batchState.batchValid += 1;
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
    void enqueueBatchRecord(record, batchState, stats, flushBatch, nodeStream, reject);
  } catch (err) {
    stats.errors.push(
      `Row ${stats.totalRows}: ${err instanceof Error ? err.message : String(err)}`,
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
  payload: MpJsonReportPayload,
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

      batchState.batch.push(record);
      batchState.batchValid += 1;
      stats.validRows += 1;

      if (batchState.batch.length >= BATCH_SIZE) {
        await flushBatch();
      }
    } catch (err) {
      stats.errors.push(
        `Row ${stats.totalRows}: ${err instanceof Error ? err.message : String(err)}`,
      );
      stats.skippedRows += 1;
    }
  }

  await flushBatch();
  console.log(`[MP Ingest] Finished processing JSON for ${reportType}. Stats:`, stats);
}

async function insertBatch(reportType: string, rows: ReportRowInput[]) {
  if (rows.length === 0) {
    return 0;
  }

  const type = reportType.toLowerCase();

  if (type.includes("settlement")) {
    const result = await db.settlementTransaction.createMany({
      data: rows as SettlementInput[],
      skipDuplicates: true,
    });
    return result.count;
  }

  const result = await db.releaseTransaction.createMany({
    data: rows as ReleaseInput[],
    skipDuplicates: true,
  });
  return result.count;
}
