/**
 * DTE Import Utilities - Shared between CSV upload and Haulmer sync
 * Handles parsing, validation, comparison, and insertion of DTE records
 */

import { db } from "@finanzas/db";
import { Decimal } from "decimal.js";

// Regex for date parsing - multiple formats supported
export const DATE_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const DATE_DASH_DOT_REGEX = /^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/;
const DATE_ISO_REGEX = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

/**
 * Parse currency amount from CSV (handles "$", ".", "," conversions)
 */
export function parseAmount(value: unknown): Decimal | null {
  if (!value || value === "") {
    return null;
  }
  const str = String(value)
    .replace(/\$/g, "") // Remove $
    .replace(/\./g, "") // Remove thousands separator (.)
    .replace(/,/g, "."); // Convert decimal comma to dot
  const num = Number(str);
  return Number.isNaN(num) ? null : new Decimal(num);
}

/**
 * Parse date from CSV (handles multiple formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD)
 */
export function parseDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  const str = String(value).trim();

  // Try DD/MM/YYYY format first
  let match = str.match(DATE_REGEX);
  if (match) {
    const [, day, month, year] = match;
    const date = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    if (date.toString() !== "Invalid Date") {
      console.log(`[Date Parse] "${str}" (DD/MM/YYYY) → ${date.toISOString()}`);
      return date;
    }
  }

  // Try DD-MM-YYYY or DD.MM.YYYY format
  match = str.match(DATE_DASH_DOT_REGEX);
  if (match) {
    const [, day, month, year] = match;
    const date = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    if (date.toString() !== "Invalid Date") {
      console.log(`[Date Parse] "${str}" (DD-MM-YYYY or DD.MM.YYYY) → ${date.toISOString()}`);
      return date;
    }
  }

  // Try YYYY-MM-DD format (ISO)
  match = str.match(DATE_ISO_REGEX);
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    if (date.toString() !== "Invalid Date") {
      console.log(`[Date Parse] "${str}" (YYYY-MM-DD) → ${date.toISOString()}`);
      return date;
    }
  }

  console.warn(
    `[Date Parse] Could not parse date: "${str}" (tried DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD)`,
  );
  return null;
}

/**
 * Build DTESaleDetail data from CSV/Haulmer row
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: field mapping required
export function buildDteSaleDetail(row: Record<string, unknown>): Record<string, unknown> {
  return {
    registerNumber: Number(row.registerNumber || 0),
    documentType: Number(row.documentType || 41),
    saleType: String(row.saleType || "Del Giro"),
    clientRUT: String(row.clientRUT || ""),
    clientName: String(row.clientName || ""),
    folio: String(row.folio || ""),
    documentDate: parseDate(row.documentDate),
    receiptDate: parseDate(row.receiptDate),
    receiptAcknowledgeDate: parseDate(row.receiptAcknowledgeDate),
    claimDate: parseDate(row.claimDate),
    period: String(row.period || ""),
    exemptAmount: parseAmount(row.exemptAmount) || new Decimal(0),
    netAmount: parseAmount(row.netAmount) || new Decimal(0),
    ivaAmount: parseAmount(row.ivaAmount) || new Decimal(0),
    totalAmount: parseAmount(row.totalAmount) || new Decimal(0),
    totalRetainedIVA: parseAmount(row.totalRetainedIVA) || new Decimal(0),
    partialRetainedIVA: parseAmount(row.partialRetainedIVA) || new Decimal(0),
    nonRetainedIVA: parseAmount(row.nonRetainedIVA) || new Decimal(0),
    ownIVA: parseAmount(row.ownIVA) || new Decimal(0),
    thirdPartyIVA: parseAmount(row.thirdPartyIVA) || new Decimal(0),
    lateIVA: parseAmount(row.lateIVA) || new Decimal(0),
    emitterRUT: row.emitterRUT ? String(row.emitterRUT) : undefined,
    commissionNetAmount: parseAmount(row.commissionNetAmount) || new Decimal(0),
    commissionExemptAmount: parseAmount(row.commissionExemptAmount) || new Decimal(0),
    commissionIVA: parseAmount(row.commissionIVA) || new Decimal(0),
    referenceDocType: row.referenceDocType ? String(row.referenceDocType) : undefined,
    referenceDocFolio: row.referenceDocFolio ? String(row.referenceDocFolio) : undefined,
    foreignBuyerIdentifier: row.foreignBuyerIdentifier
      ? String(row.foreignBuyerIdentifier)
      : undefined,
    foreignBuyerNationality: row.foreignBuyerNationality
      ? String(row.foreignBuyerNationality)
      : undefined,
    constructorCreditAmount: parseAmount(row.constructorCreditAmount) || new Decimal(0),
    freeTradeZoneAmount: parseAmount(row.freeTradeZoneAmount) || new Decimal(0),
    containerGuaranteeAmount: parseAmount(row.containerGuaranteeAmount) || new Decimal(0),
    nonBillableAmount: parseAmount(row.nonBillableAmount) || new Decimal(0),
    internationalTransportAmount: parseAmount(row.internationalTransportAmount) || new Decimal(0),
    nonCostSaleIndicator: Number(row.nonCostSaleIndicator || 0),
    periodicServiceIndicator: Number(row.periodicServiceIndicator || 0),
    totalPeriodAmount: parseAmount(row.totalPeriodAmount) || new Decimal(0),
    nationalTransportPassageAmount:
      parseAmount(row.nationalTransportPassageAmount) || new Decimal(0),
    internalNumber: row.internalNumber ? Number(row.internalNumber) : undefined,
    branchCode: row.branchCode ? String(row.branchCode) : undefined,
    origin: row.origin || "UPLOAD",
    informativeNote: row.informativeNote ? String(row.informativeNote) : undefined,
    paymentNote: row.paymentNote ? String(row.paymentNote) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

/**
 * Build DTEPurchaseDetail data from CSV/Haulmer row
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: field mapping required
export function buildDtePurchaseDetail(row: Record<string, unknown>): Record<string, unknown> {
  return {
    registerNumber: Number(row.registerNumber || 0),
    documentType: Number(row.documentType || 33),
    purchaseType: String(row.purchaseType || "Compras del Giro"),
    providerRUT: String(row.providerRUT || ""),
    providerName: String(row.providerName || ""),
    folio: String(row.folio || ""),
    documentDate: parseDate(row.documentDate),
    receiptDate: parseDate(row.receiptDate),
    acknowledgeDate: parseDate(row.acknowledgeDate),
    period: String(row.period || ""),
    exemptAmount: parseAmount(row.exemptAmount) || new Decimal(0),
    netAmount: parseAmount(row.netAmount) || new Decimal(0),
    recoverableIVA: parseAmount(row.recoverableIVA) || new Decimal(0),
    nonRecoverableIVA: parseAmount(row.nonRecoverableIVA) || new Decimal(0),
    nonRecoverableIVACode: row.nonRecoverableIVACode
      ? String(row.nonRecoverableIVACode)
      : undefined,
    totalAmount: parseAmount(row.totalAmount) || new Decimal(0),
    fixedAssetNetAmount: parseAmount(row.fixedAssetNetAmount) || new Decimal(0),
    commonUseIVA: parseAmount(row.commonUseIVA) || new Decimal(0),
    nonCreditableTax: parseAmount(row.nonCreditableTax) || new Decimal(0),
    nonRetainedIVA: parseAmount(row.nonRetainedIVA) || new Decimal(0),
    pureTobacco: parseAmount(row.pureTobacco) || new Decimal(0),
    cigaretteTobacco: parseAmount(row.cigaretteTobacco) || new Decimal(0),
    elaboratedTobacco: parseAmount(row.elaboratedTobacco) || new Decimal(0),
    otherTaxCode: row.otherTaxCode ? String(row.otherTaxCode) : undefined,
    otherTaxAmount: parseAmount(row.otherTaxAmount) || new Decimal(0),
    otherTaxRate: row.otherTaxRate ? new Decimal(String(row.otherTaxRate)) : undefined,
    referenceDocNote: row.referenceDocNote ? String(row.referenceDocNote) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
  };
}

/**
 * Compare two data objects, ignoring system fields (id, createdAt, updatedAt)
 * Returns true if any content field differs, false if all are identical
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: comparison logic
export function areDataDifferent(
  existing: Record<string, unknown>,
  newData: Record<string, unknown>,
): boolean {
  const systemFields = new Set(["id", "createdAt", "updatedAt"]);

  for (const key of Object.keys(newData)) {
    if (systemFields.has(key)) {
      continue;
    }
    const existingValue = existing[key];
    const newValue = newData[key];

    if (existingValue instanceof Object && existingValue.constructor.name === "Decimal") {
      if (newValue === null || newValue === undefined) {
        return true;
      }
      if (String(existingValue) !== String(newValue)) {
        return true;
      }
      continue;
    }

    if (existingValue instanceof Date && newValue instanceof Date) {
      if (existingValue.getTime() !== newValue.getTime()) {
        return true;
      }
      continue;
    }

    if (existingValue !== newValue) {
      return true;
    }
  }

  return false;
}

/**
 * Import a DTESaleDetail row
 */
export async function importDteSaleRow(
  row: Record<string, unknown>,
  mode: "insert-only" | "insert-or-update" = "insert-or-update",
): Promise<{ inserted: number; updated: number; skipped: number }> {
  try {
    // Validate required field
    if (!row.folio || String(row.folio).trim() === "") {
      console.warn(
        `[DTE] Sale row skipped - missing required folio. Row keys: ${Object.keys(row).join(", ")}`,
      );
      return { inserted: 0, updated: 0, skipped: 1 };
    }
    // Log raw date values before processing
    const rawDocDate = row.documentDate;
    const rawRecDate = row.receiptDate;
    console.log(
      `[DTE] Sale row ${row.folio} - documentDate raw: "${rawDocDate}" (type: ${typeof rawDocDate}, length: ${String(rawDocDate).length}), receiptDate raw: "${rawRecDate}" (type: ${typeof rawRecDate}, length: ${String(rawRecDate).length})`,
    );
    const saleData = buildDteSaleDetail(row);

    // Log parsed date values for debugging
    console.log(
      `[DTE] Sale row ${row.folio} - documentDate parsed: ${saleData.documentDate}, receiptDate parsed: ${saleData.receiptDate}`,
    );

    const existing = await db.dTESaleDetail.findFirst({
      where: { folio: String(saleData.folio) },
    });

    if (existing) {
      if (mode === "insert-only") {
        return { inserted: 0, updated: 0, skipped: 1 };
      }
      if (areDataDifferent(existing, saleData)) {
        await db.dTESaleDetail.update({
          where: { id: existing.id },
          data: saleData,
        });
        return { inserted: 0, updated: 1, skipped: 0 };
      }
      return { inserted: 0, updated: 0, skipped: 1 };
    }

    await db.dTESaleDetail.create({
      // biome-ignore lint/suspicious/noExplicitAny: Zenstack type narrowing
      data: saleData as any,
    });
    return { inserted: 1, updated: 0, skipped: 0 };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(
      `[DTE] Failed to import sale row [folio=${row.folio}, period=${row.period}]: ${msg}`,
    );
    return { inserted: 0, updated: 0, skipped: 1 };
  }
}

/**
 * Import a DTEPurchaseDetail row
 */
export async function importDtePurchaseRow(
  row: Record<string, unknown>,
  mode: "insert-only" | "insert-or-update" = "insert-or-update",
): Promise<{ inserted: number; updated: number; skipped: number }> {
  try {
    // Validate required fields
    if (!row.providerRUT || String(row.providerRUT).trim() === "") {
      console.warn(
        `[DTE] Purchase row skipped - missing required providerRUT. Row keys: ${Object.keys(row).join(", ")}`,
      );
      return { inserted: 0, updated: 0, skipped: 1 };
    }
    if (!row.folio || String(row.folio).trim() === "") {
      console.warn(
        `[DTE] Purchase row skipped - missing required folio. Row keys: ${Object.keys(row).join(", ")}`,
      );
      return { inserted: 0, updated: 0, skipped: 1 };
    }

    // Log raw date values before processing
    const rawDocDate = row.documentDate;
    const rawRecDate = row.receiptDate;
    console.log(
      `[DTE] Purchase row ${row.providerRUT}/${row.folio} - documentDate raw: "${rawDocDate}" (type: ${typeof rawDocDate}, length: ${String(rawDocDate).length}), receiptDate raw: "${rawRecDate}" (type: ${typeof rawRecDate}, length: ${String(rawRecDate).length})`,
    );

    const purchaseData = buildDtePurchaseDetail(row);

    // Log parsed date values for debugging
    console.log(
      `[DTE] Purchase row ${row.providerRUT}/${row.folio} - documentDate parsed: ${purchaseData.documentDate}, receiptDate parsed: ${purchaseData.receiptDate}`,
    );

    const existing = await db.dTEPurchaseDetail.findFirst({
      where: {
        providerRUT: String(purchaseData.providerRUT),
        folio: String(purchaseData.folio),
      },
    });

    if (existing) {
      if (mode === "insert-only") {
        return { inserted: 0, updated: 0, skipped: 1 };
      }
      if (areDataDifferent(existing, purchaseData)) {
        await db.dTEPurchaseDetail.update({
          where: { id: existing.id },
          data: purchaseData,
        });
        return { inserted: 0, updated: 1, skipped: 0 };
      }
      return { inserted: 0, updated: 0, skipped: 1 };
    }

    await db.dTEPurchaseDetail.create({
      // biome-ignore lint/suspicious/noExplicitAny: Zenstack type narrowing
      data: purchaseData as any,
    });
    return { inserted: 1, updated: 0, skipped: 0 };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(
      `[DTE] Failed to import purchase row [RUT=${row.providerRUT}, folio=${row.folio}, period=${row.period}]: ${msg}`,
    );
    return { inserted: 0, updated: 0, skipped: 1 };
  }
}
