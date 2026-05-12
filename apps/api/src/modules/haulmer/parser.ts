/**
 * Parse Haulmer CSV to DTE records
 * Uses PapaParse for robust CSV parsing with auto-delimiter detection
 * Supports both semicolon (Haulmer) and comma delimiters
 */

import Papa from "papaparse";

export type CSVRow = Record<string, string>;

/**
 * Parse CSV text to rows
 * Automatically detects delimiter (semicolon for Haulmer, comma for standard)
 */
export function parseCSVText(csvText: string): CSVRow[] {
  const results = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    // Prioritize semicolon (Haulmer) then comma (standard)
    delimitersToGuess: [";", ",", "\t", "|"],
  });

  if (results.errors.length > 0) {
    const firstError = results.errors[0];
    throw new Error(`CSV parse error: ${firstError.message}`);
  }

  // Type assertion is safe because header:true makes Papa.parse return object arrays
  return (results.data as CSVRow[]) || [];
}

/**
 * Map Haulmer CSV column to standard DTE column name
 * Handles variations in column naming
 */
// Comprehensive mapping for Haulmer CSV columns (Spanish names with accents)
const HAULMER_COLUMN_MAP: Record<string, string> = {
  // Register & Document Type
  "n°": "registerNumber",
  nº: "registerNumber",
  "register number": "registerNumber",
  "n° registro": "registerNumber",
  "registro número": "registerNumber",
  "numero registro": "registerNumber",
  // NOTE: Do NOT map "registro" - it's a status field (Pendiente/etc), not the register number

  // Document Type & Sale Type
  "tipo de documento": "documentType",
  "tipo documento": "documentType",
  "document type": "documentType",
  "tipo doc": "documentType",
  "tipo venta": "saleType",
  "tipo de venta": "saleType",
  "sale type": "saleType",
  tipo: "saleType",

  // Client Information
  "rut cliente": "clientRUT",
  rut_cliente: "clientRUT",
  "cliente rut": "clientRUT",
  rut: "clientRUT",

  "razón social": "clientName",
  "razon social": "clientName",
  "nombre cliente": "clientName",
  nombre_cliente: "clientName",
  cliente: "clientName",

  // Document & Folio
  folio: "folio",
  "numero documento": "folio",
  "número documento": "folio",
  "n° documento": "folio",
  "numero folio": "folio",
  numero_documento: "folio",

  // Dates
  "fecha documento": "documentDate",
  fecha_documento: "documentDate",
  "fecha de documento": "documentDate",
  "fecha emisión": "documentDate",
  "fecha emision": "documentDate",
  "issue date": "documentDate",
  fecha: "documentDate",

  "fecha recepción": "receiptDate",
  "fecha recepcion": "receiptDate",
  fecha_recepcion: "receiptDate",
  "fecha de recepción": "receiptDate",
  "fecha recepción conforme": "receiptDate",
  "receipt date": "receiptDate",

  "fecha acuse recibo": "receiptAcknowledgeDate",
  "fecha acuse de recibo": "receiptAcknowledgeDate",
  "fecha acuse": "receiptAcknowledgeDate",
  "acknowledgment date": "receiptAcknowledgeDate",

  "fecha reclamo": "claimDate",
  "fecha de reclamo": "claimDate",
  "claim date": "claimDate",

  // Amount - Exempt/Net/IVA/Total
  "monto exento": "exemptAmount",
  monto_exento: "exemptAmount",
  "exempt amount": "exemptAmount",
  exento: "exemptAmount",

  "monto neto": "netAmount",
  monto_neto: "netAmount",
  "monto de neto": "netAmount",
  "net amount": "netAmount",
  neto: "netAmount",

  "monto iva": "ivaAmount",
  monto_iva: "ivaAmount",
  "monto de iva": "ivaAmount",
  iva: "ivaAmount",
  impuesto: "ivaAmount",
  "tax amount": "ivaAmount",

  // Purchase-specific IVA fields
  "monto iva recuperable": "recoverableIVA",
  "monto iva no recuperable": "nonRecoverableIVA",
  "código iva no recuperable": "nonRecoverableIVACode",
  "codigo iva no recuperable": "nonRecoverableIVACode",

  "monto total": "totalAmount",
  monto_total: "totalAmount",
  "monto de total": "totalAmount",
  "total amount": "totalAmount",
  total: "totalAmount",

  // IVA Details
  "iva retenido total": "totalRetainedIVA",
  iva_retenido_total: "totalRetainedIVA",
  "total retained iva": "totalRetainedIVA",

  "iva retenido parcial": "partialRetainedIVA",
  iva_retenido_parcial: "partialRetainedIVA",
  "partial retained iva": "partialRetainedIVA",

  "iva no retenido": "nonRetainedIVA",
  iva_no_retenido: "nonRetainedIVA",
  "non retained iva": "nonRetainedIVA",

  "iva propio": "ownIVA",
  iva_propio: "ownIVA",
  "own iva": "ownIVA",

  "iva tercero": "thirdPartyIVA",
  iva_tercero: "thirdPartyIVA",
  "iva de tercero": "thirdPartyIVA",
  "third party iva": "thirdPartyIVA",

  "iva fuera de plazo": "lateIVA",
  iva_fuera_de_plazo: "lateIVA",
  "late iva": "lateIVA",

  // Commission
  "rut emisor liquid. factura": "emitterRUT",
  "rut emisor liq. factura": "emitterRUT",
  "emitter rut": "emitterRUT",

  "neto comisión liquid. factura": "commissionNetAmount",
  "neto comision liq. factura": "commissionNetAmount",
  "commission net amount": "commissionNetAmount",

  "exento comisión liquid. factura": "commissionExemptAmount",
  "exento comision liq. factura": "commissionExemptAmount",
  "commission exempt amount": "commissionExemptAmount",

  "iva comisión liquid. factura": "commissionIVA",
  "iva comision liq. factura": "commissionIVA",
  "commission iva": "commissionIVA",

  // References
  "tipo doc. referencia": "referenceDocType",
  "tipo doc referencia": "referenceDocType",
  "reference doc type": "referenceDocType",

  "folio doc. referencia": "referenceDocFolio",
  "folio doc referencia": "referenceDocFolio",
  "reference doc folio": "referenceDocFolio",

  // Foreign Buyer
  "num. ident. receptor extranjero": "foreignBuyerIdentifier",
  "num ident receptor extranjero": "foreignBuyerIdentifier",
  "foreign buyer identifier": "foreignBuyerIdentifier",

  "nacionalidad receptor extranjero": "foreignBuyerNationality",
  "nacionalidad del receptor extranjero": "foreignBuyerNationality",
  "foreign buyer nationality": "foreignBuyerNationality",

  // Special Amounts
  "crédito empresa contructora": "constructorCreditAmount",
  "credito empresa contructora": "constructorCreditAmount",
  "constructor credit amount": "constructorCreditAmount",

  "impto. zona franca (ley 18211)": "freeTradeZoneAmount",
  "impto zona franca": "freeTradeZoneAmount",
  "free trade zone amount": "freeTradeZoneAmount",

  "garantia dep. envases": "containerGuaranteeAmount",
  "garantia dep envases": "containerGuaranteeAmount",
  "container guarantee amount": "containerGuaranteeAmount",

  "monto no facturable": "nonBillableAmount",
  "non billable amount": "nonBillableAmount",

  // Purchase-specific special amounts
  "monto neto activo fijo": "fixedAssetNetAmount",
  "fixed asset net amount": "fixedAssetNetAmount",

  "iva uso común": "commonUseIVA",
  "iva uso comun": "commonUseIVA",
  "common use iva": "commonUseIVA",

  "impto. sin derecho a crédito": "nonCreditableTax",
  "impto sin derecho a credito": "nonCreditableTax",
  "impto. sin derecho a credito": "nonCreditableTax",
  "non creditable tax": "nonCreditableTax",

  // Indicators
  "indicador venta sin costo": "nonCostSaleIndicator",
  "non cost sale indicator": "nonCostSaleIndicator",

  "indicador servicio periodico": "periodicServiceIndicator",
  "indicador servicio periódico": "periodicServiceIndicator",
  "periodic service indicator": "periodicServiceIndicator",

  // Totals & Periods
  "total monto periodo": "totalPeriodAmount",
  "total monto período": "totalPeriodAmount",
  "total period amount": "totalPeriodAmount",

  "venta pasajes transporte nacional": "nationalTransportPassageAmount",
  "national transport passage amount": "nationalTransportPassageAmount",

  "venta pasajes transporte internacional": "internationalTransportAmount",
  "international transport amount": "internationalTransportAmount",

  // Internal Info
  "numero interno": "internalNumber",
  "número interno": "internalNumber",
  "internal number": "internalNumber",

  "codigo sucursal": "branchCode",
  "código sucursal": "branchCode",
  "branch code": "branchCode",

  origen: "origin",
  origin: "origin",

  "nota informativa": "informativeNote",
  "informative note": "informativeNote",

  "nota pago": "paymentNote",
  "payment note": "paymentNote",

  // Additional fields
  "nce o nde sobre fact. de compra": "referenceDocNote",
  "nce o nde": "referenceDocNote",

  "codigo otro imp.": "otherTaxCode",
  "codigo otro imp": "otherTaxCode",
  "other tax code": "otherTaxCode",

  "valor otro imp.": "otherTaxAmount",
  "valor otro imp": "otherTaxAmount",
  "other tax amount": "otherTaxAmount",

  "tasa otro imp": "otherTaxRate",
  "tasa otro imp.": "otherTaxRate",
  "other tax rate": "otherTaxRate",

  // Purchase fields
  "rut proveedor": "providerRUT",
  rut_proveedor: "providerRUT",
  "provider rut": "providerRUT",

  "nombre proveedor": "providerName",
  nombre_proveedor: "providerName",
  "provider name": "providerName",

  "tipo compra": "purchaseType",
  "tipo de compra": "purchaseType",
  "purchase type": "purchaseType",

  // Tobacco fields
  "tabacos puros": "pureTobacco",
  "tabacos cigarrillos": "cigaretteTobacco",
  "tabacos elaborados": "elaboratedTobacco",
};

export function normalizeColumnName(header: string): string {
  const normalized = header.toLowerCase().trim();
  return HAULMER_COLUMN_MAP[normalized] || header;
}

/**
 * Normalize column names in a CSV row
 */
export function normalizeRowHeaders(row: CSVRow): CSVRow {
  const normalized: CSVRow = {};

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeColumnName(key);
    normalized[normalizedKey] = value;
  }

  return normalized;
}
