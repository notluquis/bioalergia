/**
 * Parse DTE XML to extract header and line items (<Detalle> nodes).
 * Uses fast-xml-parser for robust, spec-compliant parsing.
 */

import { XMLParser } from "fast-xml-parser";

export interface DteXmlLineItem {
  lineNumber: number;
  itemName: string;
  itemDescription?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  amount: number;
  isExempt: boolean;
  itemCode?: string;
  itemCodeType?: string;
  discountPercent?: number;
  discountAmount?: number;
}

export interface DteXmlHeader {
  tipoDTE: number;
  folio: number;
  fechaEmision: string;
  rutEmisor: string;
  razonSocialEmisor: string;
  rutReceptor: string;
  razonSocialReceptor: string;
  montoNeto?: number;
  montoExento?: number;
  iva?: number;
  montoTotal: number;
}

export interface DteXmlParseResult {
  header: DteXmlHeader;
  lineItems: DteXmlLineItem[];
}

// Tags that should always be parsed as arrays even when there's only one element
const ALWAYS_ARRAY_PATHS = [
  "EnvioDTE.SetDTE.DTE.Documento.Detalle",
  "EnvioBOLETA.SetDTE.DTE.Documento.Detalle",
  "DTE.Documento.Detalle",
  "Documento.Detalle",
  // CdgItem can also repeat
  "EnvioDTE.SetDTE.DTE.Documento.Detalle.CdgItem",
  "EnvioBOLETA.SetDTE.DTE.Documento.Detalle.CdgItem",
  "DTE.Documento.Detalle.CdgItem",
  "Documento.Detalle.CdgItem",
];

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  isArray: (_name, jpath) => ALWAYS_ARRAY_PATHS.includes(String(jpath)),
  // Parse numeric-looking values as numbers
  parseTagValue: true,
  trimValues: true,
});

function toNumber(val: unknown, fallback = 0): number {
  if (val == null) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function toStr(val: unknown): string {
  if (val == null) return "";
  return String(val).trim();
}

function toStrOrUndef(val: unknown): string | undefined {
  if (val == null) return undefined;
  const s = String(val).trim();
  return s || undefined;
}

function toNumOrUndef(val: unknown): number | undefined {
  if (val == null) return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Navigate nested object to find <Documento> regardless of wrapper depth.
 * Handles: EnvioDTE > SetDTE > DTE > Documento, EnvioBOLETA > ..., bare DTE > Documento
 */
function findDocumento(parsed: Record<string, unknown>): Record<string, unknown> | null {
  // Direct <Documento>
  if (parsed.Documento && typeof parsed.Documento === "object") {
    return parsed.Documento as Record<string, unknown>;
  }

  // <DTE> > <Documento>
  const dte = parsed.DTE as Record<string, unknown> | undefined;
  if (dte?.Documento && typeof dte.Documento === "object") {
    return dte.Documento as Record<string, unknown>;
  }

  // <EnvioDTE|EnvioBOLETA> > <SetDTE> > <DTE> > <Documento>
  for (const wrapperKey of ["EnvioDTE", "EnvioBOLETA"]) {
    const wrapper = parsed[wrapperKey] as Record<string, unknown> | undefined;
    const setDte = wrapper?.SetDTE as Record<string, unknown> | undefined;
    const innerDte = setDte?.DTE as Record<string, unknown> | undefined;
    if (innerDte?.Documento && typeof innerDte.Documento === "object") {
      return innerDte.Documento as Record<string, unknown>;
    }
  }

  return null;
}

function parseHeader(doc: Record<string, unknown>): DteXmlHeader {
  const enc = (doc.Encabezado ?? {}) as Record<string, unknown>;
  const idDoc = (enc.IdDoc ?? {}) as Record<string, unknown>;
  const emisor = (enc.Emisor ?? {}) as Record<string, unknown>;
  const receptor = (enc.Receptor ?? {}) as Record<string, unknown>;
  const totales = (enc.Totales ?? {}) as Record<string, unknown>;

  return {
    tipoDTE: toNumber(idDoc.TipoDTE),
    folio: toNumber(idDoc.Folio),
    fechaEmision: toStr(idDoc.FchEmis),
    rutEmisor: toStr(emisor.RUTEmisor),
    razonSocialEmisor: toStr(emisor.RznSoc) || toStr(emisor.RznSocEmisor),
    rutReceptor: toStr(receptor.RUTRecep),
    razonSocialReceptor: toStr(receptor.RznSocRecep),
    montoNeto: toNumOrUndef(totales.MntNeto),
    montoExento: toNumOrUndef(totales.MntExe),
    iva: toNumOrUndef(totales.IVA),
    montoTotal: toNumber(totales.MntTotal),
  };
}

function parseLineItem(det: Record<string, unknown>): DteXmlLineItem {
  // Extract item code from CdgItem (array or object)
  let itemCode: string | undefined;
  let itemCodeType: string | undefined;
  const cdgItem = det.CdgItem;
  if (Array.isArray(cdgItem) && cdgItem.length > 0) {
    const first = cdgItem[0] as Record<string, unknown>;
    itemCodeType = toStrOrUndef(first.TpoCodigo);
    itemCode = toStrOrUndef(first.VlrCodigo);
  } else if (cdgItem && typeof cdgItem === "object") {
    const cdg = cdgItem as Record<string, unknown>;
    itemCodeType = toStrOrUndef(cdg.TpoCodigo);
    itemCode = toStrOrUndef(cdg.VlrCodigo);
  }

  return {
    lineNumber: toNumber(det.NroLinDet),
    itemName: toStr(det.NmbItem),
    itemDescription: toStrOrUndef(det.DscItem),
    quantity: toNumber(det.QtyItem, 1),
    unit: toStrOrUndef(det.UnmdItem),
    unitPrice: toNumber(det.PrcItem),
    amount: toNumber(det.MontoItem),
    isExempt: toNumber(det.IndExe) === 1,
    itemCode,
    itemCodeType,
    discountPercent: toNumOrUndef(det.DescuentoPct),
    discountAmount: toNumOrUndef(det.DescuentoMonto),
  };
}

/**
 * Parse a DTE XML string and extract header + line items.
 * Works with EnvioDTE (issued), EnvioBOLETA (boletas), and bare DTE (received) wrappers.
 */
export function parseDteXml(xml: string): DteXmlParseResult {
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const doc = findDocumento(parsed);

  if (!doc) {
    throw new Error("No <Documento> element found in DTE XML");
  }

  const header = parseHeader(doc);

  // Detalle is always an array thanks to isArray config
  const detalles = (doc.Detalle ?? []) as Record<string, unknown>[];
  const detalleArray = Array.isArray(detalles) ? detalles : [detalles];
  const lineItems = detalleArray.map(parseLineItem);

  return { header, lineItems };
}
