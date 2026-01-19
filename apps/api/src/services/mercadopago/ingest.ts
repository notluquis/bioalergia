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

    const rows: any[] = [];
    let isFirstRow = true;

    await new Promise<void>((resolve, reject) => {
      nodeStream
        // MercadoPago CSVs use semicolons as separators
        .pipe(csv({ separator: ";" }))
        .on("data", (row) => {
          // Clean keys (trim whitespace)
          const cleanRow: any = {};
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

          rows.push(cleanRow);
        })
        .on("end", async () => {
          try {
            stats.totalRows = rows.length;
            console.log(
              `[MP Ingest] CSV Downloaded. Rows: ${rows.length}. Starting batch insert...`,
            );

            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
              const batch = rows.slice(i, i + BATCH_SIZE);
              const batchStats = await saveReportBatch(batch, reportType);
              stats.validRows += batchStats.valid;
              stats.skippedRows += batchStats.skipped;
              stats.insertedRows += batchStats.inserted;
              stats.duplicateRows += batchStats.duplicates;
              if (batchStats.errors.length > 0) {
                stats.errors.push(...batchStats.errors);
              }
            }

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

interface BatchStats {
  valid: number;
  skipped: number;
  inserted: number;
  duplicates: number;
  errors: string[];
}

// Save batch to DB with detailed statistics
async function saveReportBatch(rows: any[], reportType: string): Promise<BatchStats> {
  const batchStats: BatchStats = {
    valid: 0,
    skipped: 0,
    inserted: 0,
    duplicates: 0,
    errors: [],
  };

  const type = reportType.toLowerCase();

  try {
    if (type.includes("settlement")) {
      const transactions = rows.map(mapRowToSettlementTransaction);

      for (const tx of transactions) {
        if (!tx.sourceId) {
          batchStats.skipped++;
          continue;
        }
        batchStats.valid++;

        try {
          // Check if exists
          const existing = await db.settlementTransaction.findUnique({
            where: { sourceId: tx.sourceId },
            select: { id: true },
          });

          if (existing) {
            batchStats.duplicates++;
          } else {
            await db.settlementTransaction.create({ data: tx });
            batchStats.inserted++;
          }
        } catch (err) {
          batchStats.errors.push(
            `Settlement ${tx.sourceId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } else if (type.includes("release")) {
      const transactions = rows.map(mapRowToReleaseTransaction);

      for (const tx of transactions) {
        if (!tx.sourceId) {
          batchStats.skipped++;
          continue;
        }
        batchStats.valid++;

        try {
          // Check if exists
          const existing = await db.releaseTransaction.findUnique({
            where: { sourceId: tx.sourceId },
            select: { id: true },
          });

          if (existing) {
            batchStats.duplicates++;
          } else {
            await db.releaseTransaction.create({ data: tx });
            batchStats.inserted++;
          }
        } catch (err) {
          batchStats.errors.push(
            `Release ${tx.sourceId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  } catch (err) {
    batchStats.errors.push(`Batch error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return batchStats;
}
