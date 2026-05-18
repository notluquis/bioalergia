// Emisión DTE Haulmer (boleta/factura) post-venta.
//
// PENDIENTE: Lucas mandará el curl exacto del endpoint de emisión.
// Esto es un stub con la estructura esperada. Cuando llegue el curl:
//  - Ajustar URL (env HAULMER_EMIT_BASE)
//  - Ajustar shape del body
//  - Ajustar shape del response (folio, tipo, URL del PDF)
//
// Las credenciales (user/pass) reutilizan las del ingest existente — el
// helper modules/haulmer/auth.ts ya entrega un JWT válido.

import { getHaulmerJwt } from "./session.ts";

type DteLine = {
  sku: string;
  name: string;
  qty: number;
  unitPriceClp: number; // IVA incluido
};

export type EmitDteInput = {
  documentType: "BOLETA" | "FACTURA";
  customerEmail: string;
  customerRut?: string | null;
  customerName: string;
  lines: DteLine[];
  totalClp: number;
};

export type EmitDteResult = {
  folio: string;
  type: string; // "39" boleta electrónica / "33" factura electrónica
  pdfUrl?: string;
};

function getEmitBase(): string {
  return (
    process.env.HAULMER_EMIT_BASE ?? "https://api.haulmer.com" // placeholder
  ).replace(/\/+$/, "");
}

export async function emitDte(input: EmitDteInput): Promise<EmitDteResult> {
  const token = await getHaulmerJwt();
  // IVA-inclusive → separar neto + iva (IVA Chile 19%).
  const totalNeto = Math.round(input.totalClp / 1.19);
  const totalIva = input.totalClp - totalNeto;

  const payload = {
    tipo_documento: input.documentType === "BOLETA" ? 39 : 33,
    receptor: {
      email: input.customerEmail,
      rut: input.customerRut ?? null,
      razon_social: input.customerName,
    },
    detalle: input.lines.map((l, idx) => ({
      nro_linea: idx + 1,
      codigo_item: l.sku,
      nombre_item: l.name,
      cantidad: l.qty,
      precio_unitario: Math.round(l.unitPriceClp / 1.19), // neto
      monto_item: Math.round((l.unitPriceClp * l.qty) / 1.19),
    })),
    totales: {
      neto: totalNeto,
      iva: totalIva,
      total: input.totalClp,
    },
  };

  const res = await fetch(`${getEmitBase()}/dte/emit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`[haulmer-emit] DTE emit ${res.status}: ${errBody}`);
  }

  const json = (await res.json()) as {
    folio: string | number;
    tipo?: string | number;
    pdf_url?: string;
  };
  return {
    folio: String(json.folio),
    type: String(json.tipo ?? payload.tipo_documento),
    ...(json.pdf_url !== undefined && { pdfUrl: json.pdf_url }),
  };
}
