import { Readable } from "node:stream";
import { db } from "@finanzas/db";
import { parse } from "fast-csv";
import { checkMpConfig, MP_ACCESS_TOKEN } from "./client";
import { mapRowToReleaseTransaction, mapRowToSettlementTransaction } from "./mappers";

// Batch size for insertions
const BATCH_SIZE = 100;

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
    console.log(`[MP Ingest] Downloading CSV from ${url}`);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });

    if (!res.ok) {
      throw new Error(`Download failed: ${res.status} - ${res.statusText}`);
    }
    const body = res.body;
    if (!body) {
      throw new Error("Empty response body");
    }

    // Convert Web Stream to Node Stream
    const nodeStream = Readable.fromWeb(body as import("stream/web").ReadableStream);

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

    await new Promise<void>((resolve, reject) => {
      // Parse CSV without header validation - manually handle headers to avoid mismatch errors
      let headerMap: Record<number, string> | null = null;

      nodeStream
        .pipe(
          parse({
            headers: false, // Don't validate headers - we'll handle them manually
            quote: "\x00", // Null char - won't appear in CSV
            escape: "\x00",
            delimiter: ",",
            trim: true, // Trim whitespace from fields
            ignoreEmpty: false,
          }),
        )
        .on("data", (row: string[] | Record<string, string | undefined>) => {
          try {
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
        })
        .on("end", async () => {
          try {
            await batchState.flushPromise;
            await flushBatch();
            console.log(`[MP Ingest] Finished processing CSV for ${reportType}. Stats:`, stats);
            resolve();
          } catch (err) {
            reject(err);
          }
        })
        .on("error", (err: Error) => {
          console.error("[MP Ingest] CSV Stream error:", err);
          reject(err);
        });
    });
  } catch (e) {
    console.error(`[MP Webhook] Failed to process CSV ${url}:`, e);
    stats.errors.push(e instanceof Error ? e.message : String(e));
    throw e;
  }

  return stats;
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
  const arrayRow = Array.isArray(row) ? row : Object.values(row);
  const objectRow: Record<string, string | undefined> = {};
  for (let i = 0; i < arrayRow.length; i++) {
    const key = headerMap[i];
    const val = arrayRow[i];
    if (key && typeof val === "string") {
      objectRow[key] = val;
    }
  }
  return objectRow;
};

const createHeaderMap = (
  row: string[] | Record<string, string | undefined>,
): Record<number, string> => {
  const headerRow = Array.isArray(row) ? row : Object.keys(row);
  return Object.fromEntries(
    headerRow.map((h, i) => [i, typeof h === "string" ? h.trim() : String(h)]),
  );
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
  const record = reportType.toLowerCase().includes("settlement")
    ? mapRowToSettlementTransaction(row)
    : mapRowToReleaseTransaction(row);
  return record.sourceId ? record : null;
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
