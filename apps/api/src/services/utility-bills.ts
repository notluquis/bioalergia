// Utility bill scrapers for Essbio (water), CGE (electricity), and future providers.
// Essbio: endpoints públicos (numero_servicio / id_servicio). CGE: orchestrator
// requiere AccessToken Cognito (ver cge-auth.ts); cae a auth estática si no hay credencial.

import { db } from "@finanzas/db";
import { Decimal } from "decimal.js";

type UtilityProvider =
  | "CGE"
  | "DOCTORALIA"
  | "ESSBIO"
  | "GASTOS_COMUNES"
  | "MASVIDA"
  | "MEDIPASS"
  | "MOVISTAR"
  | "OTHER"
  | "PREVIRED"
  | "SII"
  | "TELSUR"
  | "TGR";

const ESSBIO_BASE = "https://www.essbio.cl";
const CGE_ORCHESTRATOR = "https://orchestrator-portalescge-prd.lfr.cloud";

// ─── Raw fetchers ─────────────────────────────────────────────────────────────

export interface EssbioBillResult {
  accountNumber: string;
  address: string;
  clientName: string;
  company: string;
  currentDebt: number;
  error: null | string;
  lastPayment: { amount: number; date: string } | null;
  observation: string | null;
  previousBalance: number;
  regulated: boolean;
}

export async function fetchEssbioBill(serviceNumber: string): Promise<EssbioBillResult> {
  const form = new FormData();
  form.append("nro_servicio", serviceNumber);

  const response = await fetch(`${ESSBIO_BASE}/paymentData`, {
    method: "POST",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15",
      "X-Requested-With": "XMLHttpRequest",
      HTTP_X_REQUESTED_WITH: "XMLHttpRequest",
      Accept: "*/*",
      Origin: ESSBIO_BASE,
      Referer: `${ESSBIO_BASE}/PagoExpress`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Essbio request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    CodError?: string;
    MsgError?: null | string;
    boleta?: string;
    deuda?: number | string;
    direccion?: string;
    empresa?: string;
    item?: string;
    nombre_cliente?: string;
    observacion?: null | string;
    regulado?: string;
    saldoanterior?: number | string;
  };

  let lastPayment: { amount: number; date: string } | null = null;
  if (data.item) {
    try {
      const parsed = JSON.parse(data.item) as { Fecha?: string; Monto?: number };
      if (parsed.Fecha && parsed.Monto !== undefined) {
        lastPayment = { amount: Number(parsed.Monto), date: parsed.Fecha };
      }
    } catch {
      // ignore malformed item
    }
  }

  return {
    accountNumber: data.boleta ?? serviceNumber,
    address: data.direccion ?? "",
    clientName: data.nombre_cliente ?? "",
    company: data.empresa ?? "Essbio S.A.",
    currentDebt: Number(data.deuda ?? 0),
    error: data.MsgError !== "Ejecución correcta" ? (data.MsgError ?? null) : null,
    lastPayment,
    observation: data.observacion ?? null,
    previousBalance: Number(data.saldoanterior ?? 0),
    regulated: data.regulado === "si",
  };
}

// ─── Essbio: fecha de corte por no pago (/corteNoPago) ───────────────────────
// Solo requiere numero_servicio. Devuelve {EFecha:"DD/MM/YYYY",EError:"0",EEstado:"1"}.

const ESSBIO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15",
  "X-Requested-With": "XMLHttpRequest",
  HTTP_X_REQUESTED_WITH: "XMLHttpRequest",
  Accept: "*/*",
  Origin: ESSBIO_BASE,
  Referer: `${ESSBIO_BASE}/sucursal-virtual`,
};

// "DD/MM/YYYY" → "YYYY-MM-DD" (null si vacío/invalid)
function essbioDateToISO(value: null | string | undefined): null | string {
  if (!value) return null;
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export async function fetchEssbioDueDate(serviceNumber: string): Promise<null | string> {
  const form = new FormData();
  form.append("numero_servicio", serviceNumber);

  const response = await fetch(`${ESSBIO_BASE}/corteNoPago`, {
    method: "POST",
    headers: ESSBIO_HEADERS,
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Essbio corteNoPago failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    EError?: string;
    EEstado?: string;
    EFecha?: string;
  };

  if (data.EError && data.EError !== "0") {
    return null; // sin fecha de corte (al día) — no es error duro
  }

  return essbioDateToISO(data.EFecha);
}

// ─── Essbio: historial de facturación (/getDatos/facturacion) ────────────────
// Requiere id_servicio + numero_servicio. Devuelve array de boletas mensuales.

export interface EssbioHistoryEntry {
  consumption: number; // CONSUMO (m3)
  folio: string; // FOLIO (SII-xxx) — dedupe key
  period: string; // FECFAC normalizado MM/YYYY
  reading: number; // LECTURA (medidor)
  total: number; // TOTBOL (total boleta $)
}

export async function fetchEssbioBillingHistory(args: {
  externalAccountId: string;
  serviceNumber: string;
}): Promise<EssbioHistoryEntry[]> {
  const form = new FormData();
  form.append("id_servicio", args.externalAccountId);
  form.append("numero_servicio", args.serviceNumber);
  form.append("info", "SI");
  form.append("emp", "essbio");

  const response = await fetch(`${ESSBIO_BASE}/getDatos/facturacion`, {
    method: "POST",
    headers: ESSBIO_HEADERS,
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Essbio facturacion failed: ${response.status}`);
  }

  const data = (await response.json()) as Array<{
    CONSUMO?: number | string;
    FECFAC?: string;
    FOLIO?: string;
    LECTURA?: number | string;
    TOTBOL?: number | string;
  }>;

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((row) => row.FOLIO)
    .map((row) => ({
      consumption: Number(row.CONSUMO ?? 0),
      folio: String(row.FOLIO),
      period: (row.FECFAC ?? "").trim(), // FECFAC "05/2026" (JSON.parse ya des-escapó "\/")
      reading: Number(row.LECTURA ?? 0),
      total: Number(row.TOTBOL ?? 0),
    }));
}

export interface CgeBillResult {
  accountNumber: string;
  address: string;
  clientName: string;
  commune: string;
  company: string;
  currentBill: number;
  emissionDate: string;
  previousBill: number;
  thirdBill: number;
}

// Headers comunes del orchestrator CGE. `token` = AccessToken Cognito; si no
// hay credencial, cae al valor estático histórico "bioalergia" (puede fallar).
function cgeHeaders(token: null | string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "*/*",
    Origin: "https://sucursalvirtual.cge.cl",
    Referer: "https://sucursalvirtual.cge.cl/",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15",
    "X-Client": "react-app",
    "App-Source": "react-app",
    "x-api-auth": token ?? "bioalergia",
  };
}

export async function fetchCgeBill(
  accountNumber: string,
  token: null | string = null
): Promise<CgeBillResult> {
  const response = await fetch(`${CGE_ORCHESTRATOR}/consultarDeudaPorCuentaContrato`, {
    method: "POST",
    headers: cgeHeaders(token),
    body: JSON.stringify({
      ITEM: { CANAL: "OVIRTUAL", CTA_CTO: accountNumber },
      url: "OFVCGE_P",
    }),
  });

  if (!response.ok) {
    throw new Error(`CGE request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    code?: number;
    edatosCupon?: {
      antBoleta?: string;
      comCliente?: string;
      direCliente?: string;
      empresa?: string;
      fecEmision?: string;
      nomCliente?: string;
      terBoleta?: string;
      ultBoleta?: string;
    };
    mensaje?: string;
  };

  if (data.code !== 0) {
    throw new Error(`CGE error: ${data.mensaje ?? "Unknown error"}`);
  }

  const cupon = data.edatosCupon ?? {};

  return {
    accountNumber,
    address: cupon.direCliente ?? "",
    clientName: cupon.nomCliente ?? "",
    commune: cupon.comCliente ?? "",
    company: cupon.empresa ?? "CGE",
    currentBill: Number(cupon.ultBoleta ?? 0),
    emissionDate: cupon.fecEmision ?? "",
    previousBill: Number(cupon.antBoleta ?? 0),
    thirdBill: Number(cupon.terBoleta ?? 0),
  };
}

// ─── CGE getPagoInfo: separa deuda actual vs vencida + medios de pago ────────

export interface CgePagoInfoResult {
  currentDebt: number; // deudaActual.BETRW
  overdueDebt: number; // deudaVencida.BETRW
  raw: unknown;
}

export async function fetchCgePagoInfo(
  accountNumber: string,
  sociedad: string,
  token: null | string = null
): Promise<CgePagoInfoResult> {
  const response = await fetch(`${CGE_ORCHESTRATOR}/getPagoInfo`, {
    method: "POST",
    headers: cgeHeaders(token),
    body: JSON.stringify({
      I_CANAL: "OVIRTUAL",
      I_VKONT: accountNumber,
      Sociedad: sociedad,
      url: "OFVCGE_P",
    }),
  });

  if (!response.ok) {
    throw new Error(`CGE getPagoInfo failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    code?: number;
    deudaActual?: { BETRW?: number | string };
    deudaVencida?: { BETRW?: number | string };
    message?: string;
  };

  if (data.code !== 0) {
    throw new Error(`CGE getPagoInfo error: ${data.message ?? "Unknown"}`);
  }

  return {
    currentDebt: Number(data.deudaActual?.BETRW ?? 0),
    overdueDebt: Number(data.deudaVencida?.BETRW ?? 0),
    raw: data,
  };
}

// ─── CGE consumo histórico (estructura no documentada — passthrough raw) ──────

export async function fetchCgeConsumoHistorico(
  accountNumber: string,
  token: null | string = null
): Promise<unknown> {
  const response = await fetch(`${CGE_ORCHESTRATOR}/consultarConsumoHistoricoPorCtaCto`, {
    method: "POST",
    headers: cgeHeaders(token),
    body: JSON.stringify({ CTA_CTO: accountNumber, url: "OFVCGE_P" }),
  });

  if (!response.ok) {
    throw new Error(`CGE consumo histórico failed: ${response.status}`);
  }

  return response.json();
}

// ─── Medipass (epagos.inexoos.com) — deuda por convenio médico ───────────────
// API JSON con API key estática (Authorization + X-Api-Key, mismo valor) +
// header idEmpresa. ident_cliente = RUT de la empresa/convenio.

const MEDIPASS_BASE = "https://epagos.inexoos.com";

export interface MedipassRow {
  estado: string; // estado_pago_desc
  fechaDeuda: null | string;
  folio: number;
  monto: number;
  pendiente: boolean; // estado_pago === 0
}

export interface MedipassBillResult {
  currentDebt: number; // suma montos pendientes
  dueDate: null | string; // fecha_deuda más próxima entre pendientes
  rows: MedipassRow[];
}

// API key pública del integrador epagos (viaja en el JS del browser de Medipass,
// no es secreto). Override por env si la rotan. Mismo patrón que CGE "bioalergia".
const MEDIPASS_DEFAULT_API_KEY = "KNM1ypl0tqtu04X3hE6Es6bsxOvXqdJteB0ObbD1";

export async function fetchMedipassBill(identCliente: string): Promise<MedipassBillResult> {
  const apiKey = process.env.MEDIPASS_API_KEY ?? MEDIPASS_DEFAULT_API_KEY;
  const idEmpresa = process.env.MEDIPASS_ID_EMPRESA ?? "3";

  const response = await fetch(
    `${MEDIPASS_BASE}/epagos/pagos?ident_cliente=${encodeURIComponent(identCliente)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        Authorization: apiKey,
        "X-Api-Key": apiKey,
        idEmpresa,
        "X-Requested-With": "XMLHttpRequest",
        Referer: `${MEDIPASS_BASE}/`,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Medipass request failed: ${response.status}`);
  }

  const json = (await response.json()) as {
    data?: {
      rows?: Array<{
        estado_pago?: number;
        estado_pago_desc?: string;
        fecha_deuda?: null | string;
        folio?: number;
        monto?: number | string;
      }>;
    };
    estado?: number;
    mensaje?: string;
  };

  const rawRows = json.data?.rows ?? [];
  const rows: MedipassRow[] = rawRows.map((r) => ({
    estado: r.estado_pago_desc ?? "",
    fechaDeuda: r.fecha_deuda ?? null,
    folio: Number(r.folio ?? 0),
    monto: Number(r.monto ?? 0),
    pendiente: r.estado_pago === 0,
  }));

  const pendientes = rows.filter((r) => r.pendiente);
  const currentDebt = pendientes.reduce((sum, r) => sum + r.monto, 0);
  const dueDate =
    pendientes
      .map((r) => r.fechaDeuda)
      .filter((d): d is string => Boolean(d))
      .sort()[0] ?? null;

  return { currentDebt, dueDate, rows };
}

// ─── Normalized bill result (used by refreshAccount) ─────────────────────────

export interface BillRefreshResult {
  address: string;
  clientName: string;
  currentAmount: number;
  currentDebt: null | number;
  dueDate: null | string;
  emissionDate: null | string;
  lastPayment: { amount: number; date: string } | null;
  observation: null | string;
  previousAmount: number;
  raw: unknown;
  thirdAmount: null | number;
}

async function fetchBillForProvider(
  provider: UtilityProvider,
  serviceNumber: string
): Promise<BillRefreshResult> {
  if (provider === "ESSBIO") {
    const r = await fetchEssbioBill(serviceNumber);
    // Fecha de corte es endpoint aparte, fail-soft (no romper el refresh si falla)
    let dueDate: null | string = null;
    try {
      dueDate = await fetchEssbioDueDate(serviceNumber);
    } catch {
      // ignore — corte no disponible
    }
    return {
      address: r.address,
      clientName: r.clientName,
      currentAmount: r.currentDebt,
      currentDebt: r.currentDebt,
      dueDate,
      emissionDate: null,
      lastPayment: r.lastPayment,
      observation: r.observation,
      previousAmount: r.previousBalance,
      raw: r,
      thirdAmount: null,
    };
  }

  if (provider === "CGE") {
    // CGE orchestrator acepta x-api-auth estático ("bioalergia") — verificado
    // 2026-05-20: deuda, getPagoInfo y consumo responden sin token Cognito.
    const r = await fetchCgeBill(serviceNumber);

    // getPagoInfo separa deuda actual/vencida. Fail-soft.
    let currentDebt: null | number = null;
    let observation: null | string = null;
    let pagoRaw: unknown = null;
    try {
      const pago = await fetchCgePagoInfo(serviceNumber, r.company);
      currentDebt = pago.currentDebt;
      pagoRaw = pago.raw;
      observation =
        pago.overdueDebt > 0
          ? `Deuda vencida: ${pago.overdueDebt.toLocaleString("es-CL")}`
          : null;
    } catch {
      // getPagoInfo no disponible — usamos solo deuda del cupón
    }

    return {
      address: r.address,
      clientName: r.clientName,
      currentAmount: r.currentBill,
      currentDebt,
      dueDate: null,
      emissionDate: r.emissionDate || null,
      lastPayment: null,
      observation,
      previousAmount: r.previousBill,
      raw: { deuda: r, pagoInfo: pagoRaw },
      thirdAmount: r.thirdBill,
    };
  }

  if (provider === "MEDIPASS") {
    const r = await fetchMedipassBill(serviceNumber);
    const pendientes = r.rows.filter((row) => row.pendiente);
    return {
      address: "",
      clientName: "",
      currentAmount: r.currentDebt,
      currentDebt: r.currentDebt,
      dueDate: r.dueDate,
      emissionDate: null,
      lastPayment: null,
      observation:
        pendientes.length > 0
          ? `${pendientes.length} cobro(s) pendiente(s)`
          : "Sin deuda pendiente",
      previousAmount: 0,
      raw: r.rows,
      thirdAmount: null,
    };
  }

  throw new Error(`No scraper implemented for provider: ${provider}`);
}

// ─── UtilityAccount CRUD ──────────────────────────────────────────────────────

type ExpenseScope = "BIOALERGIA" | "PERSONAL";

export interface UtilityAccountPayload {
  expenseServiceId?: null | number;
  externalAccountId?: null | string;
  isActive?: boolean;
  label?: null | string;
  notes?: null | string;
  provider: UtilityProvider;
  scope?: ExpenseScope;
  serviceNumber: string;
}

type RawAccount = Awaited<ReturnType<typeof db.utilityAccount.findFirstOrThrow>>;

function mapAccount(a: RawAccount) {
  return {
    ...a,
    lastAmount: a.lastAmount !== null ? Number(a.lastAmount) : null,
    lastPreviousAmount: a.lastPreviousAmount !== null ? Number(a.lastPreviousAmount) : null,
  };
}

export async function listUtilityAccounts(filters: {
  isActive?: boolean;
  provider?: string;
  scope?: string;
}) {
  const accounts = await db.utilityAccount.findMany({
    where: {
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.provider ? { provider: filters.provider as UtilityProvider } : {}),
      ...(filters.scope ? { scope: filters.scope as ExpenseScope } : {}),
    },
    orderBy: [{ provider: "asc" }, { label: "asc" }],
  });
  return accounts.map(mapAccount);
}

export async function createUtilityAccount(payload: UtilityAccountPayload) {
  const account = await db.utilityAccount.create({
    data: {
      expenseServiceId: payload.expenseServiceId ?? null,
      externalAccountId: payload.externalAccountId ?? null,
      isActive: payload.isActive ?? true,
      label: payload.label ?? null,
      notes: payload.notes ?? null,
      provider: payload.provider,
      scope: payload.scope ?? "PERSONAL",
      serviceNumber: payload.serviceNumber,
    },
  });
  return mapAccount(account);
}

export async function updateUtilityAccount(id: number, payload: UtilityAccountPayload) {
  const account = await db.utilityAccount.update({
    where: { id },
    data: {
      expenseServiceId: payload.expenseServiceId ?? null,
      externalAccountId: payload.externalAccountId ?? null,
      isActive: payload.isActive ?? true,
      label: payload.label ?? null,
      notes: payload.notes ?? null,
      provider: payload.provider,
      scope: payload.scope ?? "PERSONAL",
      serviceNumber: payload.serviceNumber,
    },
  });
  return mapAccount(account);
}

export async function deleteUtilityAccount(id: number) {
  await db.utilityAccount.delete({ where: { id } });
}

export async function refreshUtilityAccount(id: number, source: string = "MANUAL") {
  const account = await db.utilityAccount.findFirst({ where: { id } });

  if (!account) {
    return null;
  }

  let bill: BillRefreshResult;
  let errorMessage: null | string = null;

  try {
    bill = await fetchBillForProvider(account.provider, account.serviceNumber);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    await db.utilityBillSnapshot.create({
      data: {
        errorMessage,
        rawResponse: { error: errorMessage } as never,
        source,
        utilityAccountId: id,
      },
    });
    throw err;
  }

  // Persist snapshot (full history)
  await db.utilityBillSnapshot.create({
    data: {
      currentAmount: new Decimal(bill.currentAmount),
      currentDebt: bill.currentDebt !== null ? new Decimal(bill.currentDebt) : null,
      dueDate: bill.dueDate,
      emissionDate: bill.emissionDate,
      lastPaymentJson: bill.lastPayment as never,
      observation: bill.observation,
      previousAmount: new Decimal(bill.previousAmount),
      rawResponse: bill.raw as never,
      source,
      thirdAmount: bill.thirdAmount !== null ? new Decimal(bill.thirdAmount) : null,
      utilityAccountId: id,
    },
  });

  const updated = await db.utilityAccount.update({
    where: { id },
    data: {
      address: bill.address,
      clientName: bill.clientName,
      lastAmount: new Decimal(bill.currentAmount),
      lastFetchedAt: new Date(),
      lastPreviousAmount: new Decimal(bill.previousAmount),
    },
  });

  return { account: mapAccount(updated), bill };
}

// Lista historial de snapshots de una cuenta
export async function listUtilityBillSnapshots(
  utilityAccountId: number,
  options: { limit?: number } = {}
) {
  const limit = options.limit ?? 24; // 24 meses default
  const snapshots = await db.utilityBillSnapshot.findMany({
    orderBy: { fetchedAt: "desc" },
    take: limit,
    where: { utilityAccountId },
  });

  return snapshots.map((s) => ({
    ...s,
    currentAmount: s.currentAmount !== null ? Number(s.currentAmount) : null,
    currentDebt: s.currentDebt !== null ? Number(s.currentDebt) : null,
    fetchedAt: s.fetchedAt.toISOString(),
    id: String(s.id),
    previousAmount: s.previousAmount !== null ? Number(s.previousAmount) : null,
    thirdAmount: s.thirdAmount !== null ? Number(s.thirdAmount) : null,
  }));
}

// FECFAC "MM/YYYY" → emissionDate "YYYY-MM-01" (día 1 del mes facturado)
function periodToEmissionDate(period: string): null | string {
  const m = period.trim().match(/^(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[2]}-${m[1]}-01`;
}

// Importa historial completo de facturación Essbio como snapshots (dedupe por folio).
// Devuelve {imported, skipped, total}.
export async function importEssbioHistory(accountId: number) {
  const account = await db.utilityAccount.findFirst({ where: { id: accountId } });
  if (!account) {
    throw new Error(`UtilityAccount ${accountId} no existe`);
  }
  if (account.provider !== "ESSBIO") {
    throw new Error(`importEssbioHistory solo aplica a ESSBIO, no ${account.provider}`);
  }
  if (!account.externalAccountId) {
    throw new Error(
      "Falta externalAccountId (id_servicio Essbio). Setéalo en la cuenta para importar historial."
    );
  }

  const history = await fetchEssbioBillingHistory({
    externalAccountId: account.externalAccountId,
    serviceNumber: account.serviceNumber,
  });

  return ingestEssbioHistory(accountId, history, null);
}

// Persiste entries Essbio como snapshots (dedupe por folio). Reutilizado por
// importEssbioHistory (fetch server-side) y por el endpoint del scraper (rows
// posteadas desde el browser con sesión autenticada). dueDate se setea en el
// snapshot más reciente (primera entry).
export async function ingestEssbioHistory(
  accountId: number,
  entries: EssbioHistoryEntry[],
  dueDate: null | string
) {
  let imported = 0;
  let skipped = 0;
  let first = true;

  for (const entry of entries) {
    const existing = await db.utilityBillSnapshot.findFirst({
      where: { folio: entry.folio, utilityAccountId: accountId },
    });
    if (existing) {
      skipped += 1;
      first = false;
      continue;
    }
    await db.utilityBillSnapshot.create({
      data: {
        consumption: entry.consumption,
        currentAmount: new Decimal(entry.total),
        dueDate: first ? dueDate : null,
        emissionDate: periodToEmissionDate(entry.period),
        folio: entry.folio,
        period: entry.period,
        rawResponse: entry as never,
        reading: entry.reading,
        source: "ESSBIO_HISTORY",
        utilityAccountId: accountId,
      },
    });
    imported += 1;
    first = false;
  }

  return { imported, skipped, total: entries.length };
}

// "YYYYMMDD" → "YYYY-MM-DD" (null si inválido)
function yyyymmddToISO(value: null | string | undefined): null | string {
  if (!value) return null;
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

// Importa historial de consumo CGE (kWh por período) como snapshots.
// CGE consumo NO trae monto por mes — solo kWh. dedupe por folio sintético.
export async function importCgeConsumoHistory(accountId: number) {
  const account = await db.utilityAccount.findFirst({ where: { id: accountId } });
  if (!account) {
    throw new Error(`UtilityAccount ${accountId} no existe`);
  }
  if (account.provider !== "CGE") {
    throw new Error(`importCgeConsumoHistory solo aplica a CGE, no ${account.provider}`);
  }

  const raw = (await fetchCgeConsumoHistorico(account.serviceNumber)) as {
    item?: Array<{
      CONSUMO_KWH?: number | string;
      FECHA_FIN?: string;
      FECHA_INICIO?: string;
    }>;
  };

  const items = Array.isArray(raw.item) ? raw.item : [];
  let imported = 0;
  let skipped = 0;

  for (const it of items) {
    const fin = yyyymmddToISO(it.FECHA_FIN); // YYYY-MM-DD
    // folio sintético estable para dedup (CGE no trae folio en consumo)
    const folio = `CGE-${it.FECHA_INICIO ?? ""}-${it.FECHA_FIN ?? ""}`;
    const period = fin ? `${fin.slice(5, 7)}/${fin.slice(0, 4)}` : null; // MM/YYYY

    const existing = await db.utilityBillSnapshot.findFirst({
      where: { folio, utilityAccountId: accountId },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await db.utilityBillSnapshot.create({
      data: {
        consumption: Number(it.CONSUMO_KWH ?? 0),
        emissionDate: fin,
        folio,
        period,
        rawResponse: it as never,
        source: "CGE_CONSUMO",
        utilityAccountId: accountId,
      },
    });
    imported += 1;
  }

  return { imported, skipped, total: items.length };
}

// Refresca todas las UtilityAccount activas — para cron
export async function refreshAllActiveUtilityAccounts() {
  const accounts = await db.utilityAccount.findMany({ where: { isActive: true } });
  const results: Array<{
    accountId: number;
    error: null | string;
    serviceNumber: string;
    success: boolean;
  }> = [];

  for (const account of accounts) {
    try {
      await refreshUtilityAccount(account.id, "CRON");
      results.push({
        accountId: account.id,
        error: null,
        serviceNumber: account.serviceNumber,
        success: true,
      });
    } catch (err) {
      results.push({
        accountId: account.id,
        error: err instanceof Error ? err.message : String(err),
        serviceNumber: account.serviceNumber,
        success: false,
      });
    }
  }

  return results;
}
