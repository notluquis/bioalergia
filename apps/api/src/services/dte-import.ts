/**
 * DTE Import Utilities - Shared between CSV upload and Haulmer sync
 * Handles parsing, validation, comparison, and insertion of DTE records
 */

import { db } from "@finanzas/db";
import { Decimal } from "decimal.js";

import { tryMatchDTEPurchaseToExpense } from "./dte-expense-matcher.ts";

// Hook fail-soft que dispara matcher después de import.
// Si match falla, NO interrumpe el import (solo loguea).
function tryMatchExpenseFailSoft(dteId: string): void {
  tryMatchDTEPurchaseToExpense(dteId)
    .then((result) => {
      if (result.status === "ERROR" || result.status === "NO_MATCH") {
        console.warn(`[DTE-Match] dte=${dteId} status=${result.status} reason=${result.reason}`);
      }
    })
    .catch((err) => {
      console.error(`[DTE-Match] dte=${dteId} unexpected error:`, err);
    });
}

// Regex for date parsing - multiple formats supported
export const DATE_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const DATE_DASH_DOT_REGEX = /^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/;
const DATE_ISO_REGEX = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const DATE_ISO_TIMESTAMP_REGEX =
  /^(\d{4})-(\d{1,2})-(\d{1,2})[T\s]\d{1,2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/;
const DOT_THOUSANDS_PATTERN = /^\d{1,3}(?:\.\d{3})+$/;
const DATE_SPLIT_PATTERN = /[T\s]/;
/**
 * Parse currency amount from CSV (handles "$", ".", "," conversions)
 */
export function parseAmount(value: unknown): Decimal | null {
  if (!value || value === "") {
    return null;
  }
  const raw = String(value).trim().replace(/\$/g, "").replace(/\s+/g, "");
  let str = raw;

  if (raw.includes(",") && raw.includes(".")) {
    if (raw.lastIndexOf(",") > raw.lastIndexOf(".")) {
      str = raw.replace(/\./g, "").replace(/,/g, ".");
    } else {
      str = raw.replace(/,/g, "");
    }
  } else if (raw.includes(",")) {
    str = raw.replace(/\./g, "").replace(/,/g, ".");
  } else if (DOT_THOUSANDS_PATTERN.test(raw)) {
    str = raw.replace(/\./g, "");
  }

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

  // Extract only date portion if timestamp exists.
  const dateOnly = str.split(DATE_SPLIT_PATTERN)[0];

  // Try ISO timestamp first (e.g. 2022-06-01T11:49:01.000Z)
  if (DATE_ISO_TIMESTAMP_REGEX.test(str)) {
    const date = new Date(str);
    if (date.toString() !== "Invalid Date") {
      return new Date(date.toISOString().slice(0, 10));
    }
  }

  // Try YYYY-MM-DD format first (Haulmer primary format)
  let match = dateOnly.match(DATE_ISO_REGEX);
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    if (date.toString() !== "Invalid Date") {
      return date;
    }
  }

  // Try DD/MM/YYYY format (backward compatibility)
  match = str.match(DATE_REGEX);
  if (match) {
    const [, day, month, year] = match;
    const date = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    if (date.toString() !== "Invalid Date") {
      return date;
    }
  }

  // Try DD-MM-YYYY or DD.MM.YYYY format
  match = str.match(DATE_DASH_DOT_REGEX);
  if (match) {
    const [, day, month, year] = match;
    const date = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
    if (date.toString() !== "Invalid Date") {
      return date;
    }
  }

  console.warn(
    `[Date Parse] Could not parse date: "${str}" (tried ISO timestamp, YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY)`
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
 * Calculate exempt amount when not provided in CSV
 * Logic: Total = Exempt + Net + IVA
 * If exempt is missing but we have net + iva + total, calculate: exempt = total - net - iva
 * Special case: if net=0 and iva=0 and total>0, then all amount is exempt
 */
function calculateExemptAmount(
  providedExempt: Decimal,
  netAmount: Decimal,
  ivaAmount: Decimal,
  totalAmount: Decimal
): Decimal {
  // If exempt amount is already provided (not zero), use it
  if (providedExempt.greaterThan(0)) {
    return providedExempt;
  }

  // If net + iva equals total, then no exempt (all taxed)
  const netPlusIva = netAmount.plus(ivaAmount);
  if (netPlusIva.equals(totalAmount)) {
    return new Decimal(0);
  }

  // Calculate exempt as: total - net - iva
  const calculated = totalAmount.minus(netAmount).minus(ivaAmount);

  // Ensure we never return negative values
  if (calculated.isNegative()) {
    console.warn(
      `[DTE] Calculated exempt amount is negative (${calculated}). Capping to 0. Net: ${netAmount}, IVA: ${ivaAmount}, Total: ${totalAmount}`
    );
    return new Decimal(0);
  }

  return calculated;
}

function getSaleLookup(row: Record<string, unknown>) {
  const saleData = buildDteSaleDetail(row);

  return {
    saleData,
    folio: String(saleData.folio),
    documentType: Number(saleData.documentType),
  };
}

/**
 * Build DTESaleDetail data from CSV/Haulmer row
 */
export function buildDteSaleDetail(row: Record<string, unknown>): Record<string, unknown> {
  const documentDate = parseDate(row.documentDate ?? row.fecha);
  const receiptDate = parseDate(row.receiptDate ?? row.fecha) ?? documentDate;

  const providedExempt = toDecimalOrZero(row.exemptAmount);
  const netAmount = toDecimalOrZero(row.netAmount ?? row.neto);
  const ivaAmount = toDecimalOrZero(row.ivaAmount ?? row.iva);
  const totalAmount = toDecimalOrZero(row.totalAmount ?? row.total);

  const exemptAmount = calculateExemptAmount(providedExempt, netAmount, ivaAmount, totalAmount);

  return {
    registerNumber: toNumber(row.registerNumber),
    documentType: toNumber(row.documentType ?? row.dte, 41),
    saleType: toRequiredString(row.saleType, "Del Giro"),
    clientRUT: toRequiredString(row.clientRUT, "66666666-6"),
    clientName: toRequiredString(row.clientName, "Cliente sin identificar"),
    folio: toRequiredString(row.folio),
    documentDate,
    receiptDate,
    receiptAcknowledgeDate: parseDate(row.receiptAcknowledgeDate),
    claimDate: parseDate(row.claimDate),
    period: toRequiredString(row.period),
    exemptAmount,
    netAmount,
    ivaAmount,
    totalAmount,
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
  const providerNameSource =
    row.providerName ?? row.clientName ?? row["Razón Social"] ?? row["Razon Social"];

  return {
    registerNumber: toNumber(row.registerNumber),
    documentType: toNumber(row.documentType, 33),
    purchaseType: toRequiredString(row.purchaseType, "Compras del Giro"),
    providerRUT: toRequiredString(row.providerRUT),
    providerName: toRequiredString(providerNameSource),
    folio: toRequiredString(row.folio),
    documentDate: parseDate(row.documentDate),
    receiptDate: parseDate(row.receiptDate),
    acknowledgeDate: parseDate(row.acknowledgeDate ?? row.receiptAcknowledgeDate),
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
  newData: Record<string, unknown>
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
 * Modes:
 *   - insert-only: Insert new records, skip existing
 *   - insert-or-update: Insert new or update existing (upsert)
 *   - update-only: Only update existing records, skip new ones
 */
export async function importDteSaleRow(
  row: Record<string, unknown>,
  mode: "insert-only" | "insert-or-update" | "update-only" = "insert-or-update"
): Promise<{ inserted: number; updated: number; skipped: number }> {
  try {
    // Validate required field
    if (!row.folio || String(row.folio).trim() === "") {
      console.warn(
        `[DTE] Sale row skipped - missing required folio. Row keys: ${Object.keys(row).join(", ")}`
      );
      return { inserted: 0, updated: 0, skipped: 1 };
    }
    const { saleData, folio, documentType } = getSaleLookup(row);

    const existing = await db.dTESaleDetail.findFirst({
      where: {
        folio,
        documentType,
      },
    });

    if (existing) {
      if (mode === "insert-only") {
        return { inserted: 0, updated: 0, skipped: 1 };
      }
      if (mode === "update-only" || mode === "insert-or-update") {
        if (areDataDifferent(existing, saleData)) {
          await db.dTESaleDetail.update({
            where: { id: existing.id },
            data: saleData,
          });
          return { inserted: 0, updated: 1, skipped: 0 };
        }
      }
      return { inserted: 0, updated: 0, skipped: 1 };
    }

    // Record does not exist
    if (mode === "update-only") {
      // Skip new records in update-only mode
      return { inserted: 0, updated: 0, skipped: 1 };
    }

    await db.dTESaleDetail.create({
      data: saleData as never,
    });
    return { inserted: 1, updated: 0, skipped: 0 };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(
      `[DTE] Failed to import sale row [folio=${row.folio}, documentType=${row.documentType ?? row.dte}, period=${row.period}]: ${msg}`
    );
    return { inserted: 0, updated: 0, skipped: 1 };
  }
}

/**
 * Import a DTEPurchaseDetail row
 * Modes:
 *   - insert-only: Insert new records, skip existing
 *   - insert-or-update: Insert new or update existing (upsert)
 *   - update-only: Only update existing records, skip new ones
 */
export async function importDtePurchaseRow(
  row: Record<string, unknown>,
  mode: "insert-only" | "insert-or-update" | "update-only" = "insert-or-update"
): Promise<{ inserted: number; updated: number; skipped: number }> {
  try {
    // Validate required fields
    if (!row.providerRUT || String(row.providerRUT).trim() === "") {
      console.warn(
        `[DTE] Purchase row skipped - missing required providerRUT. Row keys: ${Object.keys(row).join(", ")}`
      );
      return { inserted: 0, updated: 0, skipped: 1 };
    }
    if (!row.folio || String(row.folio).trim() === "") {
      console.warn(
        `[DTE] Purchase row skipped - missing required folio. Row keys: ${Object.keys(row).join(", ")}`
      );
      return { inserted: 0, updated: 0, skipped: 1 };
    }

    const purchaseData = buildDtePurchaseDetail(row);

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
      if (mode === "update-only" || mode === "insert-or-update") {
        if (areDataDifferent(existing, purchaseData)) {
          await db.dTEPurchaseDetail.update({
            where: { id: existing.id },
            data: purchaseData,
          });
          // Hook: intentar match DTE → Expense si no estaba linkeado
          void tryMatchExpenseFailSoft(existing.id);
          return { inserted: 0, updated: 1, skipped: 0 };
        }
      }
      return { inserted: 0, updated: 0, skipped: 1 };
    }

    // Record does not exist
    if (mode === "update-only") {
      // Skip new records in update-only mode
      return { inserted: 0, updated: 0, skipped: 1 };
    }

    const created = await db.dTEPurchaseDetail.create({
      data: purchaseData as never,
    });
    // Hook: intentar match DTE → Expense (fail-soft, no rompe import si falla)
    void tryMatchExpenseFailSoft(created.id);
    return { inserted: 1, updated: 0, skipped: 0 };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(
      `[DTE] Failed to import purchase row [RUT=${row.providerRUT}, folio=${row.folio}, period=${row.period}]: ${msg}`
    );
    return { inserted: 0, updated: 0, skipped: 1 };
  }
}
