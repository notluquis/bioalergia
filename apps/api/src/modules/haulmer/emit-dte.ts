// Thin compatibility shim — keeps existing services/orders + checkout flow
// pointing at `emitDte()` while the real implementation lives in
// modules/haulmer/dte-client.ts (full REST wrapper around Haulmer dashboard
// v3 endpoints).

import { emitFromOrder } from "./dte-client.ts";

export type EmitDteInput = {
  documentType: "BOLETA" | "FACTURA";
  customerEmail: string;
  customerRut?: string | null;
  customerName: string;
  lines: Array<{ sku: string; name: string; qty: number; unitPriceClp: number }>;
  totalClp: number;
};

export type EmitDteResult = {
  folio: string;
  type: string;
  pdfUrl?: string;
};

export async function emitDte(input: EmitDteInput): Promise<EmitDteResult> {
  if (input.documentType === "FACTURA" && !input.customerRut) {
    throw new Error("Factura requiere RUT del receptor");
  }
  const res = await emitFromOrder({
    documentType: input.documentType,
    customerRut: input.customerRut ?? "66666666-6", // boleta uses RUT genérico
    customerName: input.customerName,
    lines: input.lines,
    totalClp: input.totalClp,
  });
  return {
    folio: String(res.folio),
    type: input.documentType === "BOLETA" ? "39" : "33",
    ...(res.pdfUrl ? { pdfUrl: res.pdfUrl } : {}),
  };
}
