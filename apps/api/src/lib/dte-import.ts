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
 * Parse date from CSV (handles multiple formats: YYYY-MM-DD, YYYY-MM-DD HH:MM:SS, DD/MM/YYYY)
 * Haulmer sends YYYY-MM-DD (some with timestamps), null values as "-/-/-"
 */
export function parseDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  const str = String(value).trim();

  // Detect Haulmer null marker
  if (str === "-/-/-" || str === "-" || str === "") {
    return null;
  }

  // Extract only date portion if timestamp exists (YYYY-MM-DD HH:MM:SS → YYYY-MM-DD)
  const dateOnly = str.split(" ")[0];

  // Try YYYY-MM-DD format first (Haulmer primary format)
  let match = dateOnly.match(DATE_ISO_REGEX);
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    if (date.toString() !== "Invalid Date") {
      console.log(
        `[Date Parse] "${str}" (YYYY-MM-DD${str !== dateOnly ? " HH:MM:SS" : ""}) → ${date.toISOString()}`,
      );
      return date;
    }
  }

  // Try DD/MM/YYYY format (backward compatibility)
  match = str.match(DATE_REGEX);
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

  console.warn(
    `[Date Parse] Could not parse date: "${str}" (tried YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY)`,
  );
  return null;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toRequiredString(value: unknown, fallback = "") {
  if (value == null) {
    return fallback;
  }
  return String(value);
}

function toOptionalString(value: unknown) {
  if (value == null || value === "") {
    return undefined;
  }
  return String(value);
}

function toDecimalOrZero(value: unknown) {
  return parseAmount(value) ?? new Decimal(0);
}

function isDecimalLike(value: unknown): value is { constructor: { name: string } } {
  return value instanceof Object && value.constructor.name === "Decimal";
}

/**
 * Build DTESaleDetail data from CSV/Haulmer row
 */
export function buildDteSaleDetail(row: Record<string, unknown>): Record<string, unknown> {
  return {
    registerNumber: toNumber(row.registerNumber),
    documentType: toNumber(row.documentType, 41),
    saleType: toRequiredString(row.saleType, "Del Giro"),
    clientRUT: toRequiredString(row.clientRUT),
    clientName: toRequiredString(row.clientName),
    folio: toRequiredString(row.folio),
    documentDate: parseDate(row.documentDate),
    receiptDate: parseDate(row.receiptDate),
    receiptAcknowledgeDate: parseDate(row.receiptAcknowledgeDate),
    claimDate: parseDate(row.claimDate),
    period: toRequiredString(row.period),
    exemptAmount: toDecimalOrZero(row.exemptAmount),
    netAmount: toDecimalOrZero(row.netAmount),
    ivaAmount: toDecimalOrZero(row.ivaAmount),
    totalAmount: toDecimalOrZero(row.totalAmount),
    totalRetainedIVA: toDecimalOrZero(row.totalRetainedIVA),
    partialRetainedIVA: toDecimalOrZero(row.partialRetainedIVA),
    nonRetainedIVA: toDecimalOrZero(row.nonRetainedIVA),
    ownIVA: toDecimalOrZero(row.ownIVA),
    thirdPartyIVA: toDecimalOrZero(row.thirdPartyIVA),
    lateIVA: toDecimalOrZero(row.lateIVA),
    emitterRUT: toOptionalString(row.emitterRUT),
    commissionNetAmount: toDecimalOrZero(row.commissionNetAmount),
    commissionExemptAmount: toDecimalOrZero(row.commissionExemptAmount),
    commissionIVA: toDecimalOrZero(row.commissionIVA),
    referenceDocType: toOptionalString(row.referenceDocType),
    referenceDocFolio: toOptionalString(row.referenceDocFolio),
    foreignBuyerIdentifier: toOptionalString(row.foreignBuyerIdentifier),
    foreignBuyerNationality: toOptionalString(row.foreignBuyerNationality),
    constructorCreditAmount: toDecimalOrZero(row.constructorCreditAmount),
    freeTradeZoneAmount: toDecimalOrZero(row.freeTradeZoneAmount),
    containerGuaranteeAmount: toDecimalOrZero(row.containerGuaranteeAmount),
    nonBillableAmount: toDecimalOrZero(row.nonBillableAmount),
    internationalTransportAmount: toDecimalOrZero(row.internationalTransportAmount),
    nonCostSaleIndicator: toNumber(row.nonCostSaleIndicator),
    periodicServiceIndicator: toNumber(row.periodicServiceIndicator),
    totalPeriodAmount: toDecimalOrZero(row.totalPeriodAmount),
    nationalTransportPassageAmount: toDecimalOrZero(row.nationalTransportPassageAmount),
    internalNumber: row.internalNumber == null ? undefined : toNumber(row.internalNumber),
    branchCode: toOptionalString(row.branchCode),
    origin: toRequiredString(row.origin, "UPLOAD"),
    informativeNote: toOptionalString(row.informativeNote),
    paymentNote: toOptionalString(row.paymentNote),
    notes: toOptionalString(row.notes),
  };
}

/**
 * Build DTEPurchaseDetail data from CSV/Haulmer row
 */
export function buildDtePurchaseDetail(row: Record<string, unknown>): Record<string, unknown> {
  return {
    registerNumber: toNumber(row.registerNumber),
    documentType: toNumber(row.documentType, 33),
    purchaseType: toRequiredString(row.purchaseType, "Compras del Giro"),
    providerRUT: toRequiredString(row.providerRUT),
    providerName: toRequiredString(row.providerName),
    folio: toRequiredString(row.folio),
    documentDate: parseDate(row.documentDate),
    receiptDate: parseDate(row.receiptDate),
    acknowledgeDate: parseDate(row.acknowledgeDate),
    period: toRequiredString(row.period),
    exemptAmount: toDecimalOrZero(row.exemptAmount),
    netAmount: toDecimalOrZero(row.netAmount),
    recoverableIVA: toDecimalOrZero(row.recoverableIVA),
    nonRecoverableIVA: toDecimalOrZero(row.nonRecoverableIVA),
    nonRecoverableIVACode: toOptionalString(row.nonRecoverableIVACode),
    totalAmount: toDecimalOrZero(row.totalAmount),
    fixedAssetNetAmount: toDecimalOrZero(row.fixedAssetNetAmount),
    commonUseIVA: toDecimalOrZero(row.commonUseIVA),
    nonCreditableTax: toDecimalOrZero(row.nonCreditableTax),
    nonRetainedIVA: toDecimalOrZero(row.nonRetainedIVA),
    pureTobacco: toDecimalOrZero(row.pureTobacco),
    cigaretteTobacco: toDecimalOrZero(row.cigaretteTobacco),
    elaboratedTobacco: toDecimalOrZero(row.elaboratedTobacco),
    otherTaxCode: toOptionalString(row.otherTaxCode),
    otherTaxAmount: toDecimalOrZero(row.otherTaxAmount),
    otherTaxRate:
      row.otherTaxRate == null || row.otherTaxRate === ""
        ? undefined
        : new Decimal(String(row.otherTaxRate)),
    referenceDocNote: toOptionalString(row.referenceDocNote),
    notes: toOptionalString(row.notes),
  };
}

/**
 * Compare two data objects, ignoring system fields (id, createdAt, updatedAt)
 * Returns true if any content field differs, false if all are identical
 */
export function areDataDifferent(
  existing: Record<string, unknown>,
  newData: Record<string, unknown>,
): boolean {
  const systemFields = new Set(["id", "createdAt", "updatedAt"]);

  const valuesDiffer = (existingValue: unknown, nextValue: unknown) => {
    if (isDecimalLike(existingValue)) {
      if (nextValue == null) {
        return true;
      }
      return String(existingValue) !== String(nextValue);
    }
    if (existingValue instanceof Date && nextValue instanceof Date) {
      return existingValue.getTime() !== nextValue.getTime();
    }
    return existingValue !== nextValue;
  };

  for (const key of Object.keys(newData)) {
    if (systemFields.has(key)) {
      continue;
    }
    if (valuesDiffer(existing[key], newData[key])) {
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
      data: saleData as never,
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
      data: purchaseData as never,
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
