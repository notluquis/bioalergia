import { Readable } from "node:stream";
import { db } from "@finanzas/db";
import csv from "csv-parser";
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

    if (!res.ok) throw new Error(`Download failed: ${res.status} - ${res.statusText}`);
    const body = res.body;
    if (!body) throw new Error("Empty response body");

    // Convert Web Stream to Node Stream
    const nodeStream = Readable.fromWeb(body as import("stream/web").ReadableStream);

    let isFirstRow = true;
    let batch: ReportRowInput[] = [];
    let batchValid = 0;
    let flushPromise: Promise<void> = Promise.resolve();

    const flushBatch = async () => {
      if (batch.length === 0) return;
      const inserted = await insertBatch(reportType, batch);
      stats.insertedRows += inserted;
      stats.duplicateRows += Math.max(batchValid - inserted, 0);
      batch = [];
      batchValid = 0;
    };

    await new Promise<void>((resolve, reject) => {
      nodeStream
        // MercadoPago CSVs use semicolons as separators
        .pipe(csv({ separator: ";" }))
        .on("data", (row) => {
          stats.totalRows++;

          // Clean keys (trim whitespace)
          const cleanRow: Record<string, string | undefined> = {};
          for (const key in row) {
            const cleanKey = key.trim();
            cleanRow[cleanKey] = row[key]?.trim?.() ?? row[key];
          }

          // Debug: log keys of first row to verify parsing
          if (isFirstRow) {
            console.log("[MP Ingest] First row keys:", Object.keys(cleanRow));
            console.log("[MP Ingest] First row SOURCE_ID:", cleanRow.SOURCE_ID);
            isFirstRow = false;
          }

          try {
            const record = reportType.toLowerCase().includes("settlement")
              ? mapRowToSettlementTransaction(cleanRow)
              : mapRowToReleaseTransaction(cleanRow);

            if (!record.sourceId) {
              stats.skippedRows++;
              return;
            }

            batch.push(record);
            batchValid++;
            stats.validRows++;

            if (batch.length >= BATCH_SIZE) {
              nodeStream.pause();
              flushPromise = flushPromise
                .then(async () => {
                  await flushBatch();
                })
                .then(() => {
                  nodeStream.resume();
                })
                .catch((err) => {
                  reject(err);
                });
            }
          } catch (err) {
            stats.errors.push(
              `Row ${stats.totalRows}: ${err instanceof Error ? err.message : String(err)}`,
            );
            stats.skippedRows++;
          }
        })
        .on("end", async () => {
          try {
            await flushPromise;
            await flushBatch();
            console.log(`[MP Ingest] Finished processing CSV for ${reportType}. Stats:`, stats);
            resolve();
          } catch (err) {
            reject(err);
          }
        })
        .on("error", (err) => {
          console.error("[MP Webhook] CSV Stream error:", err);
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

async function insertBatch(reportType: string, rows: ReportRowInput[]) {
  if (rows.length === 0) return 0;

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
