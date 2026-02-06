/**
 * SII Standard CSV Header Mappings
 *
 * Maps standard Chilean SII (Servicio de Impuestos Internos) CSV export headers
 * to database field names for auto-detection during CSV import.
 *
 * These mappings enable automatic column detection when users upload standard
 * SII reports without manual column mapping.
 */

/**
 * DTE Compras (Purchase Documents - Tipo 33)
 * Standard SII "Libro de Compras" CSV format
 */
export const SII_COMPRAS_MAPPINGS: Record<string, string> = {
  // Column → DB Field
  Nº: "registerNumber",
  Registro: "registerNumber",
  "Tipo de Documento": "documentType",
  "Tipo Compra": "purchaseType",
  "RUT Proveedor": "providerRUT",
  "Razón Social": "providerName",
  Folio: "folio",
  "Fecha Documento": "documentDate",
  "Fecha Recepción": "receiptDate",
  "Fecha Acuse": "acknowledgeDate",
  "Monto Exento": "exemptAmount",
  "Monto Neto": "netAmount",
  " Monto IVA Recuperable": "recoverableIVA", // Note: leading space in SII export
  "Monto IVA Recuperable": "recoverableIVA",
  "Monto IVA No Recuperable": "nonRecoverableIVA",
  "Código IVA No Recuperable": "nonRecoverableIVACode",
  "Monto Total": "totalAmount",
  "Monto Neto Activo Fijo": "fixedAssetNetAmount",
  "IVA Uso Común": "commonUseIVA",
  "Impto. Sin Derecho a Crédito": "nonCreditableTax",
  "IVA No Retenido": "nonRetainedIVA",
  "Tabacos Puros": "cigarTax",
  "Tabacos Cigarrillos": "cigaretteTax",
  "Tabacos Elaborados": "tobaccoTax",
  "NCE o NDE Sobre Fact. de Compra": "referenceDocNote",
  "Código Otro Impuesto": "otherTaxCode",
  "Valor Otro Impuesto": "otherTaxAmount",
  "Tasa Otro Impuesto": "otherTaxRate",
};

/**
 * DTE Ventas (Sale Documents - Tipos 41/61)
 * Standard SII "Libro de Ventas" CSV format
 */
export const SII_VENTAS_MAPPINGS: Record<string, string> = {
  // Column → DB Field
  Nº: "registerNumber",
  "Tipo de Documento": "documentType",
  "Tipo Venta": "saleType",
  "RUT Cliente": "clientRUT",
  "Razón Social": "clientName",
  Folio: "folio",
  "Fecha Documento": "documentDate",
  "Fecha Recepción": "receiptDate",
  "Fecha Acuse Recibo": "receiptAcknowledgeDate",
  "Fecha Reclamo": "claimDate",
  "Monto Exento": "exemptAmount",
  "Monto Neto": "netAmount",
  "Monto IVA": "ivaAmount",
  "Monto Total": "totalAmount",
  "IVA Retenido Total": "totalRetainedIVA",
  "IVA Retenido Parcial": "partialRetainedIVA",
  "IVA No Retenido": "nonRetainedIVA",
  "IVA Propio": "ownIVA",
  "IVA Tercero": "thirdPartyIVA",
  "RUT Emisor Liquid. Factura": "emitterRUT",
  "Neto Comisión Liquid. Factura": "commissionNetAmount",
  "Exento Comisión Liquid. Factura": "commissionExemptAmount",
  "IVA Comisión Liquid. Factura": "commissionIVA",
  "IVA Fuera de Plazo": "lateIVA",
  "Tipo Doc. Referencia": "referenceDocType",
  "Folio Doc. Referencia": "referenceDocFolio",
  "Num. Ident. Receptor Extranjero": "foreignBuyerIdentifier",
  "Nacionalidad Receptor Extranjero": "foreignBuyerNationality",
  "Crédito Empresa Contructora": "constructorCreditAmount",
  "Impto. Zona Franca (Ley 18211)": "freeTradeZoneAmount",
  "Garantia Dep. Envases": "containerDepositGuarantee",
  "Indicador Venta sin Costo": "noCostSaleIndicator",
  "Indicador Servicio Periodico": "periodicServiceIndicator",
  "Monto No facturable": "nonBillableAmount",
  "Total Monto Periodo": "periodTotalAmount",
  "Venta Pasajes Transporte Nacional": "domesticTransportPassageAmount",
  "Venta Pasajes Transporte Internacional": "internationalTransportPassageAmount",
  "Numero Interno": "internalNumber",
  "Codigo Sucursal": "branchCode",
  "NCE o NDE sobre Fact. de Compra": "purchaseId",
  "Codigo Otro Imp.": "otherTaxCode",
  "Valor Otro Imp.": "otherTaxAmount",
  "Tasa Otro Imp": "otherTaxRate",
  Origen: "origin",
  "Nota Informativa": "informativeNote",
  "Nota Pago": "paymentNote",
};

/**
 * Get SII standard mappings for a given table
 * Returns null if table doesn't have standard SII mappings
 */
export function getSIIMappingsForTable(tableValue: string): Record<string, string> | null {
  switch (tableValue) {
    case "dte_purchases":
      return SII_COMPRAS_MAPPINGS;
    case "dte_sales":
      return SII_VENTAS_MAPPINGS;
    default:
      return null;
  }
}

/**
 * Normalize column header for comparison
 * Removes special characters, whitespace variations, and converts to lowercase
 */
export function normalizeColumnHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^\w\sáéíóúñü]/g, "") // Remove special chars except letters/spaces/accents
    .replace(/\s+/g, " "); // Normalize whitespace
}

/**
 * Match CSV header to DB field using SII mappings
 * Performs fuzzy matching with normalization
 */
export function matchSIIHeader(
  csvHeader: string,
  siiMappings: Record<string, string>,
): string | undefined {
  const normalizedCsvHeader = normalizeColumnHeader(csvHeader);

  // Direct match first
  if (siiMappings[csvHeader]) {
    return siiMappings[csvHeader];
  }

  // Fuzzy match with normalization
  for (const [siiHeader, dbField] of Object.entries(siiMappings)) {
    if (normalizeColumnHeader(siiHeader) === normalizedCsvHeader) {
      return dbField;
    }
  }

  return undefined;
}
