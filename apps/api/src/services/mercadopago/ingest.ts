import csv from "csv-parser";
import { Readable } from "stream";
import { db } from "@finanzas/db";
import { checkMpConfig, MP_ACCESS_TOKEN } from "./client";
import {
  mapRowToReleaseTransaction,
  mapRowToSettlementTransaction,
} from "./mappers";

// Batch size for insertions
const BATCH_SIZE = 100;

/**
 * Downloads and processes a CSV report from a URL.
 */
export async function processReportUrl(url: string, reportType: string) {
  try {
    checkMpConfig();
    console.log(`[MP Ingest] Downloading CSV from ${url}`); // url might be signed or direct

    // Note: We need headers if downloading directly from MP API, but webhook URLs might be pre-signed?
    // Webhook URLs are usually temporary signed URLs.
    // However, for manual process we construct the API URL which definitely needs headers.
    // To be safe, we add headers which shouldn't hurt signed URLs usually, OR we check domain.
    // Given previous implementation used headers for all, let's stick to that.

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });

    if (!res.ok)
      throw new Error(`Download failed: ${res.status} - ${res.statusText}`);
    const body = res.body;
    if (!body) throw new Error("Empty response body");

    // Convert Web Stream to Node Stream
    // @ts-ignore
    const nodeStream = Readable.fromWeb(body);

    const rows: any[] = [];

    await new Promise((resolve, reject) => {
      nodeStream
        .pipe(csv())
        .on("data", async (row) => {
          // Clean keys
          const cleanRow: any = {};
          for (const key in row) {
            cleanRow[key.trim()] = row[key];
          }
          rows.push(cleanRow);
        })
        .on("end", async () => {
          try {
            console.log(
              `[MP Ingest] CSV Downloaded. Rows: ${rows.length}. Starting batch insert...`
            );
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
              const batch = rows.slice(i, i + BATCH_SIZE);
              await saveReportBatch(batch, reportType);
            }
            console.log(
              `[MP Ingest] Finished processing CSV for ${reportType}`
            );
            resolve(true);
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
    throw e;
  }
}

// Save batch to DB
async function saveReportBatch(rows: any[], reportType: string) {
  const type = reportType.toLowerCase();

  if (type.includes("settlement")) {
    const transactions = rows
      .map(mapRowToSettlementTransaction)
      .filter((t) => t.sourceId);

    if (transactions.length > 0) {
      await db.settlementTransaction.createMany({
        data: transactions,
        skipDuplicates: true,
      });
    }
  } else if (type.includes("release")) {
    const transactions = rows
      .map(mapRowToReleaseTransaction)
      .filter((t) => t.sourceId);

    if (transactions.length > 0) {
      await db.releaseTransaction.createMany({
        data: transactions,
        skipDuplicates: true,
      });
    }
  }
}
