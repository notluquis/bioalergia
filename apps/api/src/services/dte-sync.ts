/**
 * DTE Synchronization Service
 * Handles scheduled and manual synchronization of DTEs from Haulmer
 */

import { db } from "@finanzas/db";
import dayjs from "dayjs";
import { haulmerConfig } from "../config";
import { syncPeriods } from "../modules/haulmer/service";

export interface DTESyncOptions {
  period?: string; // YYYYMM, defaults to last month
  docTypes?: ("sales" | "purchases")[];
  triggerSource?: "cron" | "manual" | "user";
  triggerUserId?: string;
}

/**
 * Get the last month period in YYYYMM format
 * @param monthsBack How many months back (default: 1 for last month)
 */
export function getLastMonthPeriod(monthsBack: number = 1): string {
  return dayjs().subtract(monthsBack, "month").format("YYYYMM");
}

/**
 * Synchronize DTEs for a specific period
 * Creates and updates DTESyncLog with results
 */
export async function syncDTEs(options: DTESyncOptions = {}): Promise<{
  status: "success" | "partial" | "failed";
  logId: string;
  period: string;
  results: {
    docType: string;
    status: string;
    inserted: number;
    updated: number;
    processed: number;
  }[];
}> {
  const period = options.period || getLastMonthPeriod();
  const docTypes = options.docTypes || ["sales", "purchases"];
  const triggerSource = options.triggerSource || "manual";
  const triggerUserId = options.triggerUserId;

  // Create DTESyncLog entry
  const syncLog = await db.dTESyncLog.create({
    data: {
      period,
      docTypes: docTypes.join(","),
      status: "PENDING",
      triggerSource,
      triggerUserId,
      startedAt: new Date(),
    },
  });

  try {
    console.log(`[DTE Sync] Starting sync for period ${period}, types: ${docTypes.join(", ")}`);

    // Call Haulmer sync service
    if (!haulmerConfig) {
      throw new Error("Haulmer not configured (missing env vars)");
    }

    const syncResults = await syncPeriods({
      rut: haulmerConfig.rut,
      periods: [period],
      docTypes,
      email: haulmerConfig.email,
      password: haulmerConfig.password,
    });

    // Calculate totals from results
    let totalProcessed = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let salesInserted = 0;
    let purchasesInserted = 0;

    const results = syncResults.map((result) => {
      totalProcessed += result.rowsProcessed;
      totalInserted += result.rowsInserted;
      totalUpdated += result.rowsUpdated;
      totalSkipped += result.rowsProcessed - result.rowsInserted - result.rowsUpdated;

      if (result.docType === "sales") {
        salesInserted += result.rowsInserted;
      } else if (result.docType === "purchases") {
        purchasesInserted += result.rowsInserted;
      }

      return {
        docType: result.docType,
        status: result.status,
        inserted: result.rowsInserted,
        updated: result.rowsUpdated,
        processed: result.rowsProcessed,
      };
    });

    // Update sync log with success
    const finalStatus = syncResults.some((r) => r.status === "failed") ? "PARTIAL" : "SUCCESS";

    await db.dteSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: finalStatus,
        totalProcessed,
        totalInserted,
        totalUpdated,
        totalSkipped,
        salesInserted,
        purchasesInserted,
        completedAt: new Date(),
      },
    });

    console.log(
      `[DTE Sync] Completed: ${finalStatus} (${totalInserted} inserted, ${totalUpdated} updated)`,
    );

    return {
      status: finalStatus === "SUCCESS" ? "success" : "partial",
      logId: syncLog.id,
      period,
      results,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update sync log with error
    await db.dteSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "FAILED",
        errorMessage,
        completedAt: new Date(),
      },
    });

    console.error(`[DTE Sync] Failed: ${errorMessage}`);

    return {
      status: "failed",
      logId: syncLog.id,
      period,
      results: [],
    };
  }
}

/**
 * Get DTE sync history with pagination
 */
export async function getDTESyncHistory(
  limit: number = 20,
  offset: number = 0,
): Promise<{
  logs: ReturnType<typeof db.dteSyncLog.findMany>;
  total: number;
}> {
  const [logs, total] = await Promise.all([
    db.dteSyncLog.findMany({
      take: limit,
      skip: offset,
      orderBy: { startedAt: "desc" },
    }),
    db.dteSyncLog.count(),
  ]);

  return { logs, total };
}
