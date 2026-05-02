// Utility bill scrapers for Essbio (water), CGE (electricity), and future providers.
// Both known endpoints are public — no auth required at runtime.

import { db } from "@finanzas/db";
import { Decimal } from "decimal.js";

type UtilityProvider = "CGE" | "ESSBIO" | "OTHER";

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

export async function fetchCgeBill(accountNumber: string): Promise<CgeBillResult> {
  const response = await fetch(`${CGE_ORCHESTRATOR}/consultarDeudaPorCuentaContrato`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
      Origin: "https://sucursalvirtual.cge.cl",
      Referer: "https://sucursalvirtual.cge.cl/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15",
      "X-Client": "react-app",
      "App-Source": "react-app",
      "x-api-auth": "bioalergia",
    },
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

// ─── Normalized bill result (used by refreshAccount) ─────────────────────────

export interface BillRefreshResult {
  address: string;
  clientName: string;
  currentAmount: number;
  previousAmount: number;
}

async function fetchBillForProvider(
  provider: UtilityProvider,
  serviceNumber: string,
): Promise<BillRefreshResult> {
  if (provider === "ESSBIO") {
    const r = await fetchEssbioBill(serviceNumber);
    return {
      address: r.address,
      clientName: r.clientName,
      currentAmount: r.currentDebt,
      previousAmount: r.previousBalance,
    };
  }

  if (provider === "CGE") {
    const r = await fetchCgeBill(serviceNumber);
    return {
      address: r.address,
      clientName: r.clientName,
      currentAmount: r.currentBill,
      previousAmount: r.previousBill,
    };
  }

  throw new Error(`No scraper implemented for provider: ${provider}`);
}

// ─── UtilityAccount CRUD ──────────────────────────────────────────────────────

type ExpenseScope = "BIOALERGIA" | "PERSONAL";

export interface UtilityAccountPayload {
  expenseServiceId?: null | number;
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

export async function refreshUtilityAccount(id: number) {
  const account = await db.utilityAccount.findFirst({ where: { id } });

  if (!account) {
    return null;
  }

  const bill = await fetchBillForProvider(account.provider, account.serviceNumber);

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
