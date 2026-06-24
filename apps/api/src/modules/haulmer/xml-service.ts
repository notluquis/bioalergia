/**
 * Service to fetch DTE XML from Haulmer, parse line items, and persist to DB.
 * Supports background job execution with progress tracking.
 */

import { db } from "@finanzas/db";
import { Decimal } from "decimal.js";
import {
  completeJob,
  failJob,
  getActiveJobsByType,
  isJobCancelled,
  startJob,
  updateJobProgress,
} from "../../lib/jobQueue.ts";
import type { HaulmerConfig } from "./auth.ts";
import { getHaulmerJwt } from "./session.ts";
import { tryDownloadDteXml } from "./xml-downloader.ts";
import { parseDteXml, type DteXmlLineItem } from "./xml-parser.ts";

const XML_FETCH_JOB_TYPE = "dte-xml-fetch";

function toDecimal(val: number): Decimal {
  return new Decimal(val);
}

function toDecimalOrUndef(val: number | undefined): Decimal | undefined {
  return val != null ? new Decimal(val) : undefined;
}

function lineItemData(item: DteXmlLineItem) {
  const discountPercent = toDecimalOrUndef(item.discountPercent);
  const discountAmount = toDecimalOrUndef(item.discountAmount);
  return {
    lineNumber: item.lineNumber,
    itemName: item.itemName,
    ...(item.itemDescription !== undefined && { itemDescription: item.itemDescription }),
    quantity: toDecimal(item.quantity),
    ...(item.unit !== undefined && { unit: item.unit }),
    unitPrice: toDecimal(item.unitPrice),
    amount: toDecimal(item.amount),
    isExempt: item.isExempt,
    ...(item.itemCode !== undefined && { itemCode: item.itemCode }),
    ...(item.itemCodeType !== undefined && { itemCodeType: item.itemCodeType }),
    ...(discountPercent !== undefined && { discountPercent }),
    ...(discountAmount !== undefined && { discountAmount }),
  };
}

async function getAuth(
  config: HaulmerConfig & { workspaceId?: string }
): Promise<{ token: string; workspaceId?: string }> {
  const token = await getHaulmerJwt(config);
  return {
    token,
    ...(config.workspaceId !== undefined && { workspaceId: config.workspaceId }),
  };
}

export interface FetchXmlLineItemsResult {
  fetched: number;
  skipped: number;
  errors: string[];
  details: Array<{
    folio: string;
    documentType: number;
    lineItemsCount: number;
    status: "fetched" | "not_found" | "error" | "already_has";
  }>;
}

interface FetchXmlProgressInfo {
  processed: number;
  total: number;
  message: string;
  fetched: number;
  skipped: number;
  errors: number;
}

interface FetchXmlOptions {
  onProgress?: (info: FetchXmlProgressInfo) => void;
  shouldCancel?: () => boolean;
}

async function fetchAndSaveSaleXml(
  dteId: string,
  config: HaulmerConfig & { workspaceId?: string },
  auth: { token: string; workspaceId?: string }
): Promise<{ folio: string; documentType: number; lineItemsCount: number; status: string }> {
  const dte = await db.dTESaleDetail.findUnique({
    where: { id: dteId },
    select: { id: true, folio: true, documentType: true, lineItems: { select: { id: true } } },
  });

  if (!dte) return { folio: "?", documentType: 0, lineItemsCount: 0, status: "error" };

  if (dte.lineItems.length > 0) {
    return {
      folio: dte.folio,
      documentType: dte.documentType,
      lineItemsCount: dte.lineItems.length,
      status: "already_has",
    };
  }

  const xml = await tryDownloadDteXml(
    { direction: "issued", ownerRut: config.rut, documentType: dte.documentType, folio: dte.folio },
    { jwtToken: auth.token, workspaceId: auth.workspaceId }
  );

  if (!xml) {
    return {
      folio: dte.folio,
      documentType: dte.documentType,
      lineItemsCount: 0,
      status: "not_found",
    };
  }

  const parsed = parseDteXml(xml);
  for (const item of parsed.lineItems) {
    const data = lineItemData(item);
    await db.dTELineItem.upsert({
      where: {
        dteSaleDetailId_lineNumber: { dteSaleDetailId: dteId, lineNumber: item.lineNumber },
      },
      create: { ...data, dteSaleDetailId: dteId },
      update: data,
    });
  }

  return {
    folio: dte.folio,
    documentType: dte.documentType,
    lineItemsCount: parsed.lineItems.length,
    status: "fetched",
  };
}

async function fetchAndSavePurchaseXml(
  dteId: string,
  config: HaulmerConfig & { workspaceId?: string },
  auth: { token: string; workspaceId?: string }
): Promise<{ folio: string; documentType: number; lineItemsCount: number; status: string }> {
  const dte = await db.dTEPurchaseDetail.findUnique({
    where: { id: dteId },
    select: {
      id: true,
      folio: true,
      documentType: true,
      providerRUT: true,
      lineItems: { select: { id: true } },
    },
  });

  if (!dte) return { folio: "?", documentType: 0, lineItemsCount: 0, status: "error" };

  if (dte.lineItems.length > 0) {
    return {
      folio: dte.folio,
      documentType: dte.documentType,
      lineItemsCount: dte.lineItems.length,
      status: "already_has",
    };
  }

  const xml = await tryDownloadDteXml(
    {
      direction: "received",
      ownerRut: config.rut,
      providerRut: dte.providerRUT,
      documentType: dte.documentType,
      folio: dte.folio,
    },
    { jwtToken: auth.token, workspaceId: auth.workspaceId }
  );

  if (!xml) {
    return {
      folio: dte.folio,
      documentType: dte.documentType,
      lineItemsCount: 0,
      status: "not_found",
    };
  }

  const parsed = parseDteXml(xml);
  for (const item of parsed.lineItems) {
    const data = lineItemData(item);
    await db.dTELineItem.upsert({
      where: {
        dtePurchaseDetailId_lineNumber: { dtePurchaseDetailId: dteId, lineNumber: item.lineNumber },
      },
      create: { ...data, dtePurchaseDetailId: dteId },
      update: data,
    });
  }

  return {
    folio: dte.folio,
    documentType: dte.documentType,
    lineItemsCount: parsed.lineItems.length,
    status: "fetched",
  };
}

/**
 * Fetch XML line items with progress callback (used by both sync and job modes).
 */
async function fetchXmlLineItemsBatch(
  dteIds: string[],
  direction: "sales" | "purchases",
  config: HaulmerConfig & { workspaceId?: string },
  options: FetchXmlOptions = {}
): Promise<FetchXmlLineItemsResult> {
  const auth = await getAuth(config);
  const result: FetchXmlLineItemsResult = { fetched: 0, skipped: 0, errors: [], details: [] };
  const total = dteIds.length;

  for (let i = 0; i < dteIds.length; i++) {
    if (options.shouldCancel?.()) {
      break;
    }

    const dteId = dteIds[i];
    if (dteId === undefined) continue;
    try {
      console.log(`[XML Fetch] ${i + 1}/${total} — DTE ${dteId} (${direction})`);
      const detail =
        direction === "sales"
          ? await fetchAndSaveSaleXml(dteId, config, auth)
          : await fetchAndSavePurchaseXml(dteId, config, auth);

      console.log(
        `[XML Fetch] ${i + 1}/${total} — Folio ${detail.folio}: ${detail.status} (${detail.lineItemsCount} items)`
      );
      if (detail.status === "fetched") result.fetched++;
      else if (detail.status === "already_has" || detail.status === "not_found") result.skipped++;

      result.details.push({
        folio: detail.folio,
        documentType: detail.documentType,
        lineItemsCount: detail.lineItemsCount,
        status: detail.status as "fetched" | "not_found" | "error" | "already_has",
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[XML Fetch] ${i + 1}/${total} — ERROR: ${msg}`);
      result.errors.push(msg);
      result.details.push({ folio: "?", documentType: 0, lineItemsCount: 0, status: "error" });
    }

    options.onProgress?.({
      processed: i + 1,
      total,
      message: `${i + 1}/${total} — ${result.fetched} obtenidos`,
      fetched: result.fetched,
      skipped: result.skipped,
      errors: result.errors.length,
    });
  }

  return result;
}

// ── Synchronous API (for individual/small fetches) ───────────────────────────

export async function fetchSaleXmlLineItems(
  dteIds: string[],
  config: HaulmerConfig & { workspaceId?: string }
): Promise<FetchXmlLineItemsResult> {
  return fetchXmlLineItemsBatch(dteIds, "sales", config);
}

export async function fetchPurchaseXmlLineItems(
  dteIds: string[],
  config: HaulmerConfig & { workspaceId?: string }
): Promise<FetchXmlLineItemsResult> {
  return fetchXmlLineItemsBatch(dteIds, "purchases", config);
}

// ── Background Job API ───────────────────────────────────────────────────────

export function getXmlFetchJobType() {
  return XML_FETCH_JOB_TYPE;
}

export function getActiveXmlFetchJob() {
  const [job] = getActiveJobsByType(XML_FETCH_JOB_TYPE);
  return job ?? null;
}

export function startXmlFetchJob(
  dteIds: string[],
  direction: "sales" | "purchases",
  config: HaulmerConfig & { workspaceId?: string }
): string {
  // Return existing job if one is running
  const active = getActiveXmlFetchJob();
  if (active) return active.id;

  const jobId = startJob(XML_FETCH_JOB_TYPE, dteIds.length);
  updateJobProgress(jobId, 0, `Preparando descarga de ${dteIds.length} XMLs...`, {
    direction,
    fetched: 0,
    skipped: 0,
    errors: 0,
  });

  const phaseStartedAt = Date.now();

  void (async () => {
    try {
      const result = await fetchXmlLineItemsBatch(dteIds, direction, config, {
        shouldCancel: () => isJobCancelled(jobId),
        onProgress: (info) => {
          const elapsedMs = Date.now() - phaseStartedAt;
          const elapsedSeconds = Math.max(0, elapsedMs / 1000);
          const remaining = info.total - info.processed;
          const etaSeconds =
            info.processed > 0 && remaining > 0 && elapsedSeconds >= 2
              ? Math.round((elapsedSeconds / info.processed) * remaining)
              : null;

          updateJobProgress(
            jobId,
            info.processed,
            info.message,
            {
              direction,
              fetched: info.fetched,
              skipped: info.skipped,
              errors: info.errors,
              elapsedSeconds: Math.round(elapsedSeconds),
              etaSeconds,
            },
            info.total
          );
        },
      });

      console.log(
        `[XML Fetch Job] Completed: ${result.fetched} fetched, ${result.skipped} skipped, ${result.errors.length} errors`
      );
      if (result.errors.length > 0) {
        console.warn(`[XML Fetch Job] Errors:`, result.errors.slice(0, 5));
      }
      completeJob(
        jobId,
        result,
        `XML fetch completado: ${result.fetched} obtenidos, ${result.skipped} omitidos`,
        {
          direction,
          fetched: result.fetched,
          skipped: result.skipped,
          errors: result.errors.length,
        }
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[XML Fetch Job] Fatal error:`, msg);
      failJob(jobId, msg);
    }
  })();

  return jobId;
}
