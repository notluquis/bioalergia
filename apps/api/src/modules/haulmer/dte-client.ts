// Haulmer DTE REST client wrapping the `api-frontend.haulmer.com` v3 endpoints
// exposed via the workspace dashboard. All requests share:
//   - Bearer JWT obtained via modules/haulmer/session.ts
//   - workspace + resource headers (Haulmer workspace selector)
//
// Endpoints implemented (matches the curl traces from the user):
//   GET  /v3/dte/core/de/invoice/dte/folios/{rut}
//   GET  /v3/dte/core/de/company/taxpayer/info/{rut}
//   GET  /v3/dte/core/de/indicator/economic/{rut}/uf
//   GET  /v3/dte/core/docs/template/sesion/{rut}/{dte}
//   POST /v3/dte/core/docs/template/borrador/{rut}
//   POST /v3/dte/filter/de/emitidos/{rut}
//   POST /v3/dte/core/docs/template/emitir/{rut}   <- emit (final)
//
// Workspace + resource IDs are env-driven (HAULMER_WORKSPACE_ID,
// HAULMER_RESOURCE_ID); RUT is parsed from HAULMER_RUT.

import { getHaulmerJwt } from "./session.ts";

const API_BASE = (process.env.HAULMER_API_BASE ?? "https://api-frontend.haulmer.com").replace(
  /\/+$/,
  ""
);
const WORKSPACE_ID = process.env.HAULMER_WORKSPACE_ID ?? "";
const RESOURCE_ID = process.env.HAULMER_RESOURCE_ID ?? WORKSPACE_ID;
const RUT_NUMERIC = (process.env.HAULMER_RUT ?? "").replace(/[.-]/g, "").replace(/[a-zA-Z]$/, "");

export const DTE_TYPE = {
  FACTURA: 33,
  FACTURA_EXENTA: 34,
  BOLETA: 39,
  BOLETA_EXENTA: 41,
  GUIA_DESPACHO: 52,
  NOTA_DEBITO: 56,
  NOTA_CREDITO: 61,
} as const;

export type DteTypeCode = (typeof DTE_TYPE)[keyof typeof DTE_TYPE];

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const token = await getHaulmerJwt();
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    workspace: WORKSPACE_ID,
    resource: RESOURCE_ID,
    Origin: "https://espacio.haulmer.com",
    Referer: "https://espacio.haulmer.com/",
    "ngsw-bypass": "true",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`[haulmer-dte] ${method} ${path} → ${res.status}: ${txt}`);
  }
  return (await res.json()) as T;
}

// ─── Read endpoints ─────────────────────────────────────────────────────────

export type FolioInfo = {
  dte: number;
  tipo: string;
  siguiente: number;
  disponibles: number;
  disponibles_web: number;
  alerta: number;
  fecha_sii: string | null;
  timbraje: {
    estado: boolean;
    fecha: string;
    detalle: {
      siguiente: number;
      disponibles: number;
      desde: number;
      hasta: number;
      timbrados: number;
    };
    error: string | null;
  };
};

export async function listFolios(): Promise<FolioInfo[]> {
  const json = await call<{ details: FolioInfo[] }>(
    "GET",
    `/v3/dte/core/de/invoice/dte/folios/${RUT_NUMERIC}`
  );
  return json.details;
}

export type TaxpayerInfo = {
  rut: number;
  dv: string;
  razon_social: string;
  giro: string;
  email: string;
  telefono: string;
  direccion: string;
  comuna: string;
  comuna_nombre: string;
  direccion_regional: string;
  actividad_economica: number;
  actividad_nombre: string;
  config_extra_nombre_fantasia: string;
  config_extra_sucursales: Array<{
    codigo: string;
    sucursal: string;
    direccion: string;
    comuna_nombre: string;
  }>;
};

export async function getTaxpayerInfo(): Promise<TaxpayerInfo> {
  const json = await call<{ details: TaxpayerInfo }>(
    "GET",
    `/v3/dte/core/de/company/taxpayer/info/${RUT_NUMERIC}`
  );
  return json.details;
}

export type EconomicIndicator = {
  indicador: string;
  periodo: number;
  valor: number;
};

export async function getUF(): Promise<EconomicIndicator> {
  const json = await call<{ details: EconomicIndicator }>(
    "GET",
    `/v3/dte/core/de/indicator/economic/${RUT_NUMERIC}/uf`
  );
  return json.details;
}

export type EmittedDte = {
  RUTEmisor: number;
  TipoDTE: number;
  NombreDTE: string;
  Folio: number;
  RUTRecep: number;
  RznSocRecep: string;
  FchEmis: string;
  MntNeto: number;
  MntExe: number;
  IVA: number;
  MntTotal: number;
  TrackId: number;
  RevisionEstado: string;
  RevisionDetalle: string;
  Token: string;
  Periodo: number;
};

export async function listEmitted(opts: {
  dteType?: DteTypeCode;
  page?: number;
  limit?: number;
}): Promise<{ data: EmittedDte[]; current_page: number; last_page: number; total: number }> {
  const body: Record<string, unknown> = { limit: opts.limit ?? 15 };
  if (opts.dteType !== undefined) body.TipoDTE = { eq: opts.dteType };
  return await call(
    "POST",
    `/v3/dte/filter/de/emitidos/${RUT_NUMERIC}?page=${opts.page ?? 1}`,
    body
  );
}

// ─── Draft + Emit ───────────────────────────────────────────────────────────

export type DraftLine = {
  numero: number;
  sku: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number; // IVA incluido CLP
};

export type DraftInput = {
  dteType: DteTypeCode;
  customer: { rut: string; razonSocial?: string };
  emisorSucursalCodigo?: string;
  lines: DraftLine[];
  totalClp: number;
  paymentNote?: string;
  informationNote?: string;
};

async function getSession(dteType: DteTypeCode): Promise<number> {
  const json = await call<{ details: { sesion: number } }>(
    "GET",
    `/v3/dte/core/docs/template/sesion/${RUT_NUMERIC}/${dteType}`
  );
  return json.details.sesion;
}

function buildBorradorPayload(sesion: number, input: DraftInput, emisor: TaxpayerInfo) {
  const today = new Date().toISOString().slice(0, 10);
  const totalNeto = Math.round(input.totalClp / 1.19);
  const iva = input.totalClp - totalNeto;
  const sucursalCode =
    input.emisorSucursalCodigo ?? emisor.config_extra_sucursales[0]?.codigo ?? "";

  return {
    sesion,
    contribuyente: Number(RUT_NUMERIC),
    dte: input.dteType,
    borrador: {
      Encabezado: {
        IdDoc: { TipoDTE: input.dteType, Folio: "", FchEmis: today, IndServicio: "3" },
        Emisor: {
          RUTEmisor: `${RUT_NUMERIC}-${emisor.dv}`,
          RznSocEmisor: emisor.razon_social,
          GiroEmisor: emisor.giro,
          CdgSIISucur: sucursalCode,
          DirOrigen: emisor.direccion,
          CmnaOrigen: emisor.comuna_nombre,
          CiudadOrigen: emisor.comuna_nombre,
        },
        Receptor: {
          RUTRecep: input.customer.rut,
          ...(input.customer.razonSocial !== undefined && {
            RznSocRecep: input.customer.razonSocial,
          }),
        },
        Totales: {
          MntNeto: String(totalNeto),
          MntExe: "0",
          IVA: String(iva),
          MntTotal: String(input.totalClp),
          MontoNF: "0",
          TotalPeriodo: String(input.totalClp),
          VlrPagar: String(input.totalClp),
        },
      },
      Detalle: input.lines.map((l) => ({
        NroLinDet: l.numero,
        NmbItem: l.nombre,
        QtyItem: String(l.cantidad),
        PrcItem: String(l.precioUnitario),
        MontoItem: String(l.cantidad * l.precioUnitario),
        CdgItem: [{ TpoCodigo: "INT", VlrCodigo: l.sku }],
      })),
      custom: {
        informationNote: input.informationNote ?? "",
        paymentNote: input.paymentNote ?? "",
      },
    },
  };
}

export async function saveDraft(input: DraftInput): Promise<{ sesion: number }> {
  const [sesion, emisor] = await Promise.all([getSession(input.dteType), getTaxpayerInfo()]);
  await call(
    "POST",
    `/v3/dte/core/docs/template/borrador/${RUT_NUMERIC}`,
    buildBorradorPayload(sesion, input, emisor)
  );
  return { sesion };
}

export type EmitResult = {
  folio: number;
  token: string;
  trackId: number;
  pdfUrl: string;
};

// NOTE: the final-emit curl wasn't captured. Hauler dashboard usually calls
// `POST /v3/dte/core/docs/template/emitir/{rut}` with the same sesion id.
// If Haulmer responds 404/422, the path needs adjustment with one more
// browser trace from the dashboard during a real emit.
export async function emitFinal(sesion: number, dteType: DteTypeCode): Promise<EmitResult> {
  const json = await call<{
    details: {
      folio?: number | string;
      token?: string;
      trackId?: number;
      pdf_url?: string;
    };
  }>("POST", `/v3/dte/core/docs/template/emitir/${RUT_NUMERIC}`, {
    sesion,
    contribuyente: Number(RUT_NUMERIC),
    dte: dteType,
  });
  const folio = Number(json.details.folio ?? 0);
  return {
    folio,
    token: json.details.token ?? "",
    trackId: json.details.trackId ?? 0,
    pdfUrl: json.details.pdf_url ?? "",
  };
}

export async function emitFromOrder(input: {
  documentType: "BOLETA" | "FACTURA";
  customerRut: string;
  customerName: string;
  lines: Array<{ sku: string; name: string; qty: number; unitPriceClp: number }>;
  totalClp: number;
}): Promise<EmitResult> {
  const dteType: DteTypeCode = input.documentType === "BOLETA" ? DTE_TYPE.BOLETA : DTE_TYPE.FACTURA;
  const { sesion } = await saveDraft({
    dteType,
    customer: { rut: input.customerRut, razonSocial: input.customerName },
    lines: input.lines.map((l, i) => ({
      numero: i + 1,
      sku: l.sku,
      nombre: l.name,
      cantidad: l.qty,
      precioUnitario: l.unitPriceClp,
    })),
    totalClp: input.totalClp,
  });
  return await emitFinal(sesion, dteType);
}
