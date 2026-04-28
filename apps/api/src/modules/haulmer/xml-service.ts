/**
 * Service to fetch DTE XML from Haulmer, parse line items, and persist to DB.
 */

import { db } from "@finanzas/db";
import Decimal from "decimal.js";
import type { DteXmlLineItem } from "./xml-parser";

function toDecimal(val: number): Decimal {
  return new Decimal(val);
}

function toDecimalOrUndef(val: number | undefined): Decimal | undefined {
  return val != null ? new Decimal(val) : undefined;
}

function lineItemData(item: DteXmlLineItem) {
  return {
    lineNumber: item.lineNumber,
    itemName: item.itemName,
    itemDescription: item.itemDescription,
    quantity: toDecimal(item.quantity),
    unit: item.unit,
    unitPrice: toDecimal(item.unitPrice),
    amount: toDecimal(item.amount),
    isExempt: item.isExempt,
    itemCode: item.itemCode,
    itemCodeType: item.itemCodeType,
    discountPercent: toDecimalOrUndef(item.discountPercent),
    discountAmount: toDecimalOrUndef(item.discountAmount),
  };
}
import type { HaulmerConfig } from "./auth";
import { captureHaulmerJWT, isJWTExpired } from "./auth";
import { tryDownloadDteXml } from "./xml-downloader";
import { parseDteXml } from "./xml-parser";

let cachedJWT: { token: string; expiresAt: Date; workspaceId?: string } | null = null;

async function getAuth(config: HaulmerConfig & { workspaceId?: string }) {
  if (cachedJWT && !isJWTExpired(cachedJWT.expiresAt)) {
    return cachedJWT;
  }
  const response = await captureHaulmerJWT(config);
  cachedJWT = {
    token: response.jwtToken,
    expiresAt: response.expiresAt,
    workspaceId: config.workspaceId,
  };
  return cachedJWT;
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

/**
 * Fetch XML and extract line items for specific sale DTEs.
 */
export async function fetchSaleXmlLineItems(
  dteIds: string[],
  config: HaulmerConfig & { workspaceId?: string },
): Promise<FetchXmlLineItemsResult> {
  const auth = await getAuth(config);
  const result: FetchXmlLineItemsResult = { fetched: 0, skipped: 0, errors: [], details: [] };

  for (const dteId of dteIds) {
    const dte = await db.dTESaleDetail.findUnique({
      where: { id: dteId },
      select: { id: true, folio: true, documentType: true, lineItems: { select: { id: true } } },
    });

    if (!dte) {
      result.errors.push(`DTE ${dteId} not found`);
      continue;
    }

    // Skip if already has line items
    if (dte.lineItems.length > 0) {
      result.skipped++;
      result.details.push({
        folio: dte.folio,
        documentType: dte.documentType,
        lineItemsCount: dte.lineItems.length,
        status: "already_has",
      });
      continue;
    }

    try {
      const xml = await tryDownloadDteXml(
        {
          direction: "issued",
          ownerRut: config.rut,
          documentType: dte.documentType,
          folio: dte.folio,
        },
        { jwtToken: auth.token, workspaceId: auth.workspaceId },
      );

      if (!xml) {
        result.skipped++;
        result.details.push({
          folio: dte.folio,
          documentType: dte.documentType,
          lineItemsCount: 0,
          status: "not_found",
        });
        continue;
      }

      const parsed = parseDteXml(xml);

      // Upsert line items
      for (const item of parsed.lineItems) {
        const data = lineItemData(item);
        await db.dTELineItem.upsert({
          where: {
            dteSaleDetailId_lineNumber: {
              dteSaleDetailId: dteId,
              lineNumber: item.lineNumber,
            },
          },
          create: { ...data, dteSaleDetailId: dteId },
          update: data,
        });
      }

      result.fetched++;
      result.details.push({
        folio: dte.folio,
        documentType: dte.documentType,
        lineItemsCount: parsed.lineItems.length,
        status: "fetched",
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Folio ${dte.folio}: ${msg}`);
      result.details.push({
        folio: dte.folio,
        documentType: dte.documentType,
        lineItemsCount: 0,
        status: "error",
      });
    }
  }

  return result;
}

/**
 * Fetch XML and extract line items for specific purchase DTEs.
 */
export async function fetchPurchaseXmlLineItems(
  dteIds: string[],
  config: HaulmerConfig & { workspaceId?: string },
): Promise<FetchXmlLineItemsResult> {
  const auth = await getAuth(config);
  const result: FetchXmlLineItemsResult = { fetched: 0, skipped: 0, errors: [], details: [] };

  for (const dteId of dteIds) {
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

    if (!dte) {
      result.errors.push(`DTE ${dteId} not found`);
      continue;
    }

    if (dte.lineItems.length > 0) {
      result.skipped++;
      result.details.push({
        folio: dte.folio,
        documentType: dte.documentType,
        lineItemsCount: dte.lineItems.length,
        status: "already_has",
      });
      continue;
    }

    try {
      const xml = await tryDownloadDteXml(
        {
          direction: "received",
          ownerRut: config.rut,
          providerRut: dte.providerRUT,
          documentType: dte.documentType,
          folio: dte.folio,
        },
        { jwtToken: auth.token, workspaceId: auth.workspaceId },
      );

      if (!xml) {
        result.skipped++;
        result.details.push({
          folio: dte.folio,
          documentType: dte.documentType,
          lineItemsCount: 0,
          status: "not_found",
        });
        continue;
      }

      const parsed = parseDteXml(xml);

      for (const item of parsed.lineItems) {
        const data = lineItemData(item);
        await db.dTELineItem.upsert({
          where: {
            dtePurchaseDetailId_lineNumber: {
              dtePurchaseDetailId: dteId,
              lineNumber: item.lineNumber,
            },
          },
          create: { ...data, dtePurchaseDetailId: dteId },
          update: data,
        });
      }

      result.fetched++;
      result.details.push({
        folio: dte.folio,
        documentType: dte.documentType,
        lineItemsCount: parsed.lineItems.length,
        status: "fetched",
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      result.errors.push(`Folio ${dte.folio}: ${msg}`);
      result.details.push({
        folio: dte.folio,
        documentType: dte.documentType,
        lineItemsCount: 0,
        status: "error",
      });
    }
  }

  return result;
}
