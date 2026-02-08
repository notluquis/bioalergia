/**
 * Parse Haulmer CSV to DTE records
 * Maps Haulmer CSV headers to DTESaleDetail/DTEPurchaseDetail structure
 */

export type CSVRow = Record<string, string>;

/**
 * Parse CSV text to rows
 * Handles quoted fields and commas within quotes
 */
export function parseCSVText(csvText: string): CSVRow[] {
  const lines = csvText.split("\n");
  if (lines.length < 2) {
    throw new Error("CSV too short: no header row");
  }

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      continue;
    }

    const values = parseCSVLine(line);
    const row: CSVRow = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Parse single CSV line, respecting quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map((val) => val.trim());
}

/**
 * Map Haulmer CSV column to standard DTE column name
 * Handles variations in column naming
 */
export function normalizeColumnName(header: string): string {
  const normalized = header.toLowerCase().trim();

  // Sales columns
  if (["rut_cliente", "rut cliente", "cliente rut"].includes(normalized)) {
    return "clientRUT";
  }
  if (["nombre_cliente", "nombre cliente", "cliente"].includes(normalized)) {
    return "clientName";
  }
  if (["tipo_documento", "tipo documento", "document type", "tipo doc"].includes(normalized)) {
    return "documentType";
  }
  if (["numero_documento", "número documento", "n° documento", "folio"].includes(normalized)) {
    return "folio";
  }
  if (["fecha_emision", "fecha emisión", "issue date", "fecha"].includes(normalized)) {
    return "documentDate";
  }
  if (
    ["fecha_recepcion_conforme", "fecha recepción conforme", "receipt date"].includes(normalized)
  ) {
    return "receiptDate";
  }
  if (["monto_neto", "monto neto", "neto", "net amount"].includes(normalized)) {
    return "netAmount";
  }
  if (["monto_iva", "monto iva", "iva", "impuesto", "tax amount"].includes(normalized)) {
    return "ivaAmount";
  }
  if (["monto_total", "monto total", "total", "total amount"].includes(normalized)) {
    return "totalAmount";
  }
  if (["impuesto_adicional", "impuesto adicional", "additional tax"].includes(normalized)) {
    return "additionalTax";
  }
  if (["moneda", "currency"].includes(normalized)) {
    return "currency";
  }
  if (["referencia", "glosa", "reference", "notes"].includes(normalized)) {
    return "reference";
  }
  if (["estado", "status", "document status"].includes(normalized)) {
    return "documentStatus";
  }
  if (
    ["registro_numero", "registro número", "register number", "n° registro"].includes(normalized)
  ) {
    return "registerNumber";
  }
  if (["tipo_venta", "tipo venta", "sale type", "tipo"].includes(normalized)) {
    return "saleType";
  }

  // If no mapping found, return header as-is
  return header;
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
