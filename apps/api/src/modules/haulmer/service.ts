/**
 * Haulmer sync service
 * Orchestrates JWT capture, CSV download, parsing, and sync logging
 */

import { db } from "@finanzas/db";
import { importDtePurchaseRow, importDteSaleRow } from "../../lib/dte-import";
import { captureHaulmerJWT, type HaulmerConfig, isJWTExpired } from "./auth";
import { downloadHaulmerCSV } from "./downloader";
import { normalizeColumnName, parseCSVText } from "./parser";

export interface HaulmerSyncOptions {
  rut: string;
  periods: string[];
  docTypes: ("sales" | "purchases")[];
  email: string;
  password: string;
}

export interface SyncSummary {
  period: string;
  docType: "sales" | "purchases";
  status: "success" | "failed" | "skipped";
  rowsProcessed: number;
  rowsInserted: number;
  rowsUpdated: number;
  error?: string;
}

let cachedJWT: { token: string; expiresAt: Date } | null = null;

/**
 * Get or refresh JWT token
 */
async function getJWT(config: HaulmerConfig) {
  if (cachedJWT && !isJWTExpired(cachedJWT.expiresAt)) {
    return cachedJWT;
  }

  console.log("[Haulmer Sync] Requesting fresh JWT");
  const response = await captureHaulmerJWT(config);

  cachedJWT = {
    token: response.jwtToken,
    expiresAt: response.expiresAt,
  };

  return cachedJWT;
}

/**
 * Sync a single period and document type
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: error handling pattern
export async function syncPeriod(
  rut: string,
  period: string,
  docType: "sales" | "purchases",
  config: HaulmerConfig,
): Promise<SyncSummary> {
  let rowsInserted = 0;
  let rowsUpdated = 0;
  let rowsSkipped = 0;

  try {
    // Get JWT
    const jwt = await getJWT(config);

    // Download CSV
    const csvText = await downloadHaulmerCSV(rut, period, docType, jwt.token);

    // Parse CSV
    const rows = parseCSVText(csvText);

    // Normalize column names and add period to each row
    let columnsNormalized = 0;
    for (const row of rows) {
      // Add period field (required for import functions)
      row.period = period;

      // Log raw column names before normalization (first row only for debugging)
      if (rows.indexOf(row) === 0) {
        console.log(`[Haulmer Sync] Raw columns: ${Object.keys(row).join(", ")}`);
      }

      // Normalize column names
      const normalizedRow: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        const normalizedKey = normalizeColumnName(key);
        if (normalizedKey !== key) {
          columnsNormalized++;
        }
        normalizedRow[normalizedKey] = value;
      }

      // Replace row with normalized version
      for (const k of Object.keys(row)) {
        delete row[k];
      }
      Object.assign(row, normalizedRow);
    }

    console.log(
      `[Haulmer Sync] Downloaded and parsed ${rows.length} rows for ${docType}/${period} (normalized ${columnsNormalized} fields)`,
    );

    // Log sample row columns after normalization to verify mapping worked
    if (rows.length > 0) {
      console.log(
        `[Haulmer Sync] Sample normalized row columns: ${Object.keys(rows[0]).join(", ")}`,
      );
    }

    // Process rows using shared library functions
    for (const row of rows) {
      try {
        const result =
          docType === "sales"
            ? await importDteSaleRow(row, "insert-or-update")
            : await importDtePurchaseRow(row, "insert-or-update");
        rowsInserted += result.inserted;
        rowsUpdated += result.updated;
        rowsSkipped += result.skipped;
      } catch (err) {
        rowsSkipped++;
        console.warn(`[Haulmer] Skip row for ${docType}:`, err);
      }
    }

    console.log(
      `[Haulmer Sync] Completed ${docType}/${period}: ${rowsInserted} inserted, ${rowsUpdated} updated, ${rowsSkipped} skipped`,
    );

    const result: SyncSummary = {
      period,
      docType,
      status: "success",
      rowsProcessed: rows.length,
      rowsInserted,
      rowsUpdated,
    };

    // Save sync log (upsert to handle re-syncing)
    await db.haulmerSyncLog.upsert({
      where: { period_rut_docType: { period, rut, docType } },
      create: {
        period,
        rut,
        docType,
        rowsCreated: rowsInserted,
        rowsUpdated,
        rowsSkipped,
        status: "success",
        csvSize: csvText.length,
      },
      update: {
        rowsCreated: rowsInserted,
        rowsUpdated,
        rowsSkipped,
        status: "success",
        csvSize: csvText.length,
      },
    });

    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Haulmer Sync] Error for ${docType}/${period}: ${msg}`);

    // Save error log (upsert to handle re-syncing)
    try {
      await db.haulmerSyncLog.upsert({
        where: { period_rut_docType: { period, rut, docType } },
        create: {
          period,
          rut,
          docType,
          rowsCreated: rowsInserted,
          rowsUpdated,
          rowsSkipped,
          status: "failed",
          errorMessage: msg,
        },
        update: {
          rowsCreated: rowsInserted,
          rowsUpdated,
          rowsSkipped,
          status: "failed",
          errorMessage: msg,
        },
      });
    } catch (logErr) {
      console.error("[Haulmer] Failed to save error log:", logErr);
    }

    return {
      period,
      docType,
      status: "failed",
      rowsProcessed: rowsInserted + rowsUpdated + rowsSkipped,
      rowsInserted,
      rowsUpdated,
      error: msg,
    };
  }
}

/**
 * Sync multiple periods
 */
export async function syncPeriods(options: HaulmerSyncOptions): Promise<SyncSummary[]> {
  const results: SyncSummary[] = [];
  const config: HaulmerConfig = {
    email: options.email,
    password: options.password,
    rut: options.rut,
  };

  for (const period of options.periods) {
    for (const docType of options.docTypes) {
      const result = await syncPeriod(options.rut, period, docType, config);
      results.push(result);
    }
  }

  return results;
}
