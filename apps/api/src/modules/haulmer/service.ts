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

function normalizeParsedRows(rows: Record<string, unknown>[], period: string) {
  let columnsNormalized = 0;
  for (const [index, row] of rows.entries()) {
    row.period = period;
    if (index === 0) {
      console.log(`[Haulmer Sync] Raw columns: ${Object.keys(row).join(", ")}`);
    }

    const normalizedRow: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = normalizeColumnName(key);
      if (normalizedKey !== key) {
        columnsNormalized++;
      }
      normalizedRow[normalizedKey] = value;
    }
    for (const key of Object.keys(row)) {
      delete row[key];
    }
    Object.assign(row, normalizedRow);
  }
  return columnsNormalized;
}

async function importParsedRows(rows: Record<string, unknown>[], docType: "sales" | "purchases") {
  let rowsInserted = 0;
  let rowsUpdated = 0;
  let rowsSkipped = 0;

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

  return { rowsInserted, rowsSkipped, rowsUpdated };
}

async function saveSyncSuccessLog(params: {
  csvSize: number;
  docType: "sales" | "purchases";
  period: string;
  rowsInserted: number;
  rowsSkipped: number;
  rowsUpdated: number;
  rut: string;
}) {
  await db.haulmerSyncLog.upsert({
    where: {
      period_rut_docType: { period: params.period, rut: params.rut, docType: params.docType },
    },
    create: {
      period: params.period,
      rut: params.rut,
      docType: params.docType,
      rowsCreated: params.rowsInserted,
      rowsUpdated: params.rowsUpdated,
      rowsSkipped: params.rowsSkipped,
      status: "success",
      csvSize: params.csvSize,
    },
    update: {
      rowsCreated: params.rowsInserted,
      rowsUpdated: params.rowsUpdated,
      rowsSkipped: params.rowsSkipped,
      status: "success",
      csvSize: params.csvSize,
    },
  });
}

/**
 * Sync a single period and document type
 */
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
    const columnsNormalized = normalizeParsedRows(rows, period);

    console.log(
      `[Haulmer Sync] Downloaded and parsed ${rows.length} rows for ${docType}/${period} (normalized ${columnsNormalized} fields)`,
    );

    // Log sample row columns after normalization to verify mapping worked
    if (rows.length > 0) {
      console.log(
        `[Haulmer Sync] Sample normalized row columns: ${Object.keys(rows[0]).join(", ")}`,
      );
    }

    ({ rowsInserted, rowsSkipped, rowsUpdated } = await importParsedRows(rows, docType));

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

    await saveSyncSuccessLog({
      csvSize: csvText.length,
      docType,
      period,
      rowsInserted,
      rowsSkipped,
      rowsUpdated,
      rut,
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
