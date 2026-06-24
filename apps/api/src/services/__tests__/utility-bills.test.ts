import { Decimal } from "decimal.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DomainError } from "../../lib/errors.ts";

// utility-bills.ts toca db.utilityAccount / db.utilityBillSnapshot + hace fetch
// a endpoints externos (Essbio/CGE/Medipass). Mockeamos @finanzas/db (vi.hoisted)
// y stubbeamos global fetch para cubrir: parsers de respuesta de los fetchers,
// CRUD, dedupe de ingest/import y las ramas DomainError de los guards.

const {
  mockDb,
  mockAccountFindMany,
  mockAccountFindFirst,
  mockAccountCreate,
  mockAccountUpdate,
  mockAccountDelete,
  mockSnapshotFindMany,
  mockSnapshotFindFirst,
  mockSnapshotCreate,
} = vi.hoisted(() => {
  const mockAccountFindMany = vi.fn();
  const mockAccountFindFirst = vi.fn();
  const mockAccountCreate = vi.fn();
  const mockAccountUpdate = vi.fn();
  const mockAccountDelete = vi.fn();
  const mockSnapshotFindMany = vi.fn();
  const mockSnapshotFindFirst = vi.fn();
  const mockSnapshotCreate = vi.fn();
  const mockDb = {
    utilityAccount: {
      findMany: (...a: unknown[]) => mockAccountFindMany(...a),
      findFirst: (...a: unknown[]) => mockAccountFindFirst(...a),
      create: (...a: unknown[]) => mockAccountCreate(...a),
      update: (...a: unknown[]) => mockAccountUpdate(...a),
      delete: (...a: unknown[]) => mockAccountDelete(...a),
    },
    utilityBillSnapshot: {
      findMany: (...a: unknown[]) => mockSnapshotFindMany(...a),
      findFirst: (...a: unknown[]) => mockSnapshotFindFirst(...a),
      create: (...a: unknown[]) => mockSnapshotCreate(...a),
    },
  };
  return {
    mockDb,
    mockAccountFindMany,
    mockAccountFindFirst,
    mockAccountCreate,
    mockAccountUpdate,
    mockAccountDelete,
    mockSnapshotFindMany,
    mockSnapshotFindFirst,
    mockSnapshotCreate,
  };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));

import {
  cgeHeaders,
  createUtilityAccount,
  deleteUtilityAccount,
  essbioDateToISO,
  fetchCgeBill,
  fetchCgeConsumoHistorico,
  fetchCgePagoInfo,
  fetchEssbioBill,
  fetchEssbioBillingHistory,
  fetchEssbioDueDate,
  fetchMedipassBill,
  importCgeConsumoHistory,
  importEssbioHistory,
  ingestEssbioHistory,
  listUtilityAccounts,
  mapAccount,
  periodToEmissionDate,
  refreshAllActiveUtilityAccounts,
  refreshUtilityAccount,
  updateUtilityAccount,
} from "../utility-bills.ts";

type RawAccount = Parameters<typeof mapAccount>[0];

// ─── fetch stub helpers ───────────────────────────────────────────────────────

const fetchMock = vi.fn();

function res(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return { ok: init.ok ?? true, status: init.status ?? 200, json: async () => body };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAccountFindMany.mockReset();
  mockAccountFindFirst.mockReset();
  mockAccountCreate.mockReset();
  mockAccountUpdate.mockReset();
  mockAccountDelete.mockReset();
  mockSnapshotFindMany.mockReset();
  mockSnapshotFindFirst.mockReset();
  mockSnapshotCreate.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Pure helpers (pre-existing coverage) ─────────────────────────────────────

describe("essbioDateToISO", () => {
  it('converts "DD/MM/YYYY" to "YYYY-MM-DD"', () => {
    expect(essbioDateToISO("18/05/2026")).toBe("2026-05-18");
    expect(essbioDateToISO("01/12/1999")).toBe("1999-12-01");
    expect(essbioDateToISO("31/01/2000")).toBe("2000-01-31");
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(essbioDateToISO("  18/05/2026  ")).toBe("2026-05-18");
  });

  it("returns null for null/undefined/empty", () => {
    expect(essbioDateToISO(null)).toBeNull();
    expect(essbioDateToISO(undefined)).toBeNull();
    expect(essbioDateToISO("")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(essbioDateToISO("2026-05-18")).toBeNull(); // ISO, not DD/MM/YYYY
    expect(essbioDateToISO("5/5/2026")).toBeNull(); // single digits
    expect(essbioDateToISO("18/05/26")).toBeNull(); // 2-digit year
    expect(essbioDateToISO("18-05-2026")).toBeNull(); // dashes
    expect(essbioDateToISO("18/05/2026  extra")).toBeNull(); // trailing junk
    expect(essbioDateToISO("x18/05/2026")).toBeNull(); // leading junk
    expect(essbioDateToISO("not a date")).toBeNull();
  });
});

describe("periodToEmissionDate", () => {
  it('converts "MM/YYYY" to "YYYY-MM-01"', () => {
    expect(periodToEmissionDate("05/2026")).toBe("2026-05-01");
    expect(periodToEmissionDate("12/1999")).toBe("1999-12-01");
    expect(periodToEmissionDate("01/2000")).toBe("2000-01-01");
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(periodToEmissionDate("  05/2026  ")).toBe("2026-05-01");
  });

  it("returns null for malformed input", () => {
    expect(periodToEmissionDate("")).toBeNull();
    expect(periodToEmissionDate("2026-05")).toBeNull(); // dash format
    expect(periodToEmissionDate("202605")).toBeNull(); // no separator
    expect(periodToEmissionDate("5/2026")).toBeNull(); // single-digit month
    expect(periodToEmissionDate("05/26")).toBeNull(); // 2-digit year
    expect(periodToEmissionDate("05/2026/01")).toBeNull(); // extra component
    expect(periodToEmissionDate("18/05/2026")).toBeNull(); // DD/MM/YYYY
    expect(periodToEmissionDate("junk")).toBeNull();
  });
});

describe("cgeHeaders", () => {
  it("uses the provided token as x-api-auth", () => {
    expect(cgeHeaders("my-cognito-token")["x-api-auth"]).toBe("my-cognito-token");
  });

  it('falls back to "bioalergia" when token is null', () => {
    expect(cgeHeaders(null)["x-api-auth"]).toBe("bioalergia");
  });

  it("returns the exact full header set with a token", () => {
    expect(cgeHeaders("tok123")).toEqual({
      "Content-Type": "application/json",
      Accept: "*/*",
      Origin: "https://sucursalvirtual.cge.cl",
      Referer: "https://sucursalvirtual.cge.cl/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15",
      "X-Client": "react-app",
      "App-Source": "react-app",
      "x-api-auth": "tok123",
    });
  });

  it("returns the exact full header set with null token", () => {
    expect(cgeHeaders(null)).toEqual({
      "Content-Type": "application/json",
      Accept: "*/*",
      Origin: "https://sucursalvirtual.cge.cl",
      Referer: "https://sucursalvirtual.cge.cl/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15",
      "X-Client": "react-app",
      "App-Source": "react-app",
      "x-api-auth": "bioalergia",
    });
  });

  it("keeps the auth header present and non-empty for both branches", () => {
    expect("x-api-auth" in cgeHeaders("t")).toBe(true);
    expect(cgeHeaders("t")["x-api-auth"]).not.toBe("");
    expect(cgeHeaders(null)["x-api-auth"]).not.toBe("");
  });
});

describe("mapAccount", () => {
  const baseAccount = {
    id: 7,
    provider: "CGE",
    serviceNumber: "123456",
    label: "Casa",
  } as unknown as RawAccount;

  it("converts Decimal lastAmount/lastPreviousAmount to numbers", () => {
    const result = mapAccount({
      ...baseAccount,
      lastAmount: new Decimal("45000"),
      lastPreviousAmount: new Decimal("38000.5"),
    } as RawAccount);

    expect(result.lastAmount).toBe(45000);
    expect(result.lastPreviousAmount).toBe(38000.5);
  });

  it("preserves null lastAmount/lastPreviousAmount as null (not 0)", () => {
    const result = mapAccount({
      ...baseAccount,
      lastAmount: null,
      lastPreviousAmount: null,
    } as RawAccount);

    expect(result.lastAmount).toBeNull();
    expect(result.lastPreviousAmount).toBeNull();
  });

  it("maps each side independently (one null, one set)", () => {
    const result = mapAccount({
      ...baseAccount,
      lastAmount: new Decimal("100"),
      lastPreviousAmount: null,
    } as RawAccount);

    expect(result.lastAmount).toBe(100);
    expect(result.lastPreviousAmount).toBeNull();
  });

  it("spreads all other fields through unchanged", () => {
    const result = mapAccount({
      ...baseAccount,
      lastAmount: new Decimal("1"),
      lastPreviousAmount: new Decimal("2"),
    } as RawAccount);

    expect(result.id).toBe(7);
    expect(result.provider).toBe("CGE");
    expect(result.serviceNumber).toBe("123456");
    expect(result.label).toBe("Casa");
  });

  it("treats zero Decimal as 0, not null", () => {
    const result = mapAccount({
      ...baseAccount,
      lastAmount: new Decimal("0"),
      lastPreviousAmount: new Decimal("0"),
    } as RawAccount);

    expect(result.lastAmount).toBe(0);
    expect(result.lastPreviousAmount).toBe(0);
  });
});

// ─── Essbio fetchers ──────────────────────────────────────────────────────────

describe("fetchEssbioBill", () => {
  it("throws when the HTTP response is not ok", async () => {
    fetchMock.mockResolvedValueOnce(res({}, { ok: false, status: 502 }));
    await expect(fetchEssbioBill("123")).rejects.toThrow("Essbio request failed: 502");
  });

  it("maps a full payload into the normalized shape", async () => {
    fetchMock.mockResolvedValueOnce(
      res({
        boleta: "B-1",
        direccion: "Calle 1",
        nombre_cliente: "Juan",
        empresa: "Essbio Maule",
        deuda: "12345",
        MsgError: "boom",
        observacion: "obs",
        saldoanterior: 999,
        regulado: "si",
        item: JSON.stringify({ Fecha: "2026-05-01", Monto: 5000 }),
      })
    );

    const r = await fetchEssbioBill("123");
    expect(r).toEqual({
      accountNumber: "B-1",
      address: "Calle 1",
      clientName: "Juan",
      company: "Essbio Maule",
      currentDebt: 12345,
      error: "boom",
      lastPayment: { amount: 5000, date: "2026-05-01" },
      observation: "obs",
      previousBalance: 999,
      regulated: true,
    });
  });

  it("applies defaults for missing fields and falls back accountNumber to serviceNumber", async () => {
    fetchMock.mockResolvedValueOnce(res({}));
    const r = await fetchEssbioBill("svc-9");
    expect(r.accountNumber).toBe("svc-9");
    expect(r.address).toBe("");
    expect(r.clientName).toBe("");
    expect(r.company).toBe("Essbio S.A.");
    expect(r.currentDebt).toBe(0);
    expect(r.previousBalance).toBe(0);
    expect(r.lastPayment).toBeNull();
    expect(r.observation).toBeNull();
    expect(r.regulated).toBe(false);
  });

  it('treats MsgError "Ejecución correcta" as no error', async () => {
    fetchMock.mockResolvedValueOnce(res({ MsgError: "Ejecución correcta" }));
    expect((await fetchEssbioBill("1")).error).toBeNull();
  });

  it("regulated is false for any value other than 'si'", async () => {
    fetchMock.mockResolvedValueOnce(res({ regulado: "no" }));
    expect((await fetchEssbioBill("1")).regulated).toBe(false);
  });

  it("ignores a malformed item JSON (lastPayment null)", async () => {
    fetchMock.mockResolvedValueOnce(res({ item: "{not json" }));
    expect((await fetchEssbioBill("1")).lastPayment).toBeNull();
  });

  it("ignores item missing Monto (lastPayment null)", async () => {
    fetchMock.mockResolvedValueOnce(res({ item: JSON.stringify({ Fecha: "2026-01-01" }) }));
    expect((await fetchEssbioBill("1")).lastPayment).toBeNull();
  });
});

describe("fetchEssbioDueDate", () => {
  it("throws when the HTTP response is not ok", async () => {
    fetchMock.mockResolvedValueOnce(res({}, { ok: false, status: 500 }));
    await expect(fetchEssbioDueDate("1")).rejects.toThrow("Essbio corteNoPago failed: 500");
  });

  it("returns null when EError is non-zero (al día, no corte)", async () => {
    fetchMock.mockResolvedValueOnce(res({ EError: "1", EFecha: "18/05/2026" }));
    expect(await fetchEssbioDueDate("1")).toBeNull();
  });

  it("parses EFecha when EError is '0'", async () => {
    fetchMock.mockResolvedValueOnce(res({ EError: "0", EFecha: "18/05/2026" }));
    expect(await fetchEssbioDueDate("1")).toBe("2026-05-18");
  });

  it("parses EFecha when EError is absent (falsy)", async () => {
    fetchMock.mockResolvedValueOnce(res({ EFecha: "01/12/2025" }));
    expect(await fetchEssbioDueDate("1")).toBe("2025-12-01");
  });
});

describe("fetchEssbioBillingHistory", () => {
  it("throws when the HTTP response is not ok", async () => {
    fetchMock.mockResolvedValueOnce(res({}, { ok: false, status: 503 }));
    await expect(
      fetchEssbioBillingHistory({ externalAccountId: "id", serviceNumber: "svc" })
    ).rejects.toThrow("Essbio facturacion failed: 503");
  });

  it("returns [] when the payload is not an array", async () => {
    fetchMock.mockResolvedValueOnce(res({ not: "array" }));
    expect(
      await fetchEssbioBillingHistory({ externalAccountId: "id", serviceNumber: "svc" })
    ).toEqual([]);
  });

  it("filters out rows without FOLIO and maps the rest with numeric defaults", async () => {
    fetchMock.mockResolvedValueOnce(
      res([
        { FOLIO: "SII-1", CONSUMO: "10", FECFAC: " 05/2026 ", LECTURA: "100", TOTBOL: "20000" },
        { CONSUMO: 5, FECFAC: "04/2026" }, // no FOLIO → dropped
        { FOLIO: "SII-2" }, // missing numerics → 0
      ])
    );

    const r = await fetchEssbioBillingHistory({ externalAccountId: "id", serviceNumber: "svc" });
    expect(r).toEqual([
      { consumption: 10, folio: "SII-1", period: "05/2026", reading: 100, total: 20000 },
      { consumption: 0, folio: "SII-2", period: "", reading: 0, total: 0 },
    ]);
  });
});

// ─── CGE fetchers ─────────────────────────────────────────────────────────────

describe("fetchCgeBill", () => {
  it("throws when the HTTP response is not ok", async () => {
    fetchMock.mockResolvedValueOnce(res({}, { ok: false, status: 500 }));
    await expect(fetchCgeBill("acc")).rejects.toThrow("CGE request failed: 500");
  });

  it("throws a CGE error when code != 0", async () => {
    fetchMock.mockResolvedValueOnce(res({ code: 7, mensaje: "cuenta inválida" }));
    await expect(fetchCgeBill("acc")).rejects.toThrow("CGE error: cuenta inválida");
  });

  it("throws with 'Unknown error' when code != 0 and no mensaje", async () => {
    fetchMock.mockResolvedValueOnce(res({ code: 1 }));
    await expect(fetchCgeBill("acc")).rejects.toThrow("CGE error: Unknown error");
  });

  it("maps edatosCupon into the normalized bill", async () => {
    fetchMock.mockResolvedValueOnce(
      res({
        code: 0,
        edatosCupon: {
          direCliente: "Av 2",
          nomCliente: "Ana",
          comCliente: "Chillán",
          empresa: "CGE SA",
          ultBoleta: "30000",
          fecEmision: "2026-05-10",
          antBoleta: "28000",
          terBoleta: "27000",
        },
      })
    );

    expect(await fetchCgeBill("acc-1")).toEqual({
      accountNumber: "acc-1",
      address: "Av 2",
      clientName: "Ana",
      commune: "Chillán",
      company: "CGE SA",
      currentBill: 30000,
      emissionDate: "2026-05-10",
      previousBill: 28000,
      thirdBill: 27000,
    });
  });

  it("applies defaults when edatosCupon is absent", async () => {
    fetchMock.mockResolvedValueOnce(res({ code: 0 }));
    const r = await fetchCgeBill("acc-2");
    expect(r.company).toBe("CGE");
    expect(r.currentBill).toBe(0);
    expect(r.previousBill).toBe(0);
    expect(r.thirdBill).toBe(0);
    expect(r.emissionDate).toBe("");
  });
});

describe("fetchCgePagoInfo", () => {
  it("throws when the HTTP response is not ok", async () => {
    fetchMock.mockResolvedValueOnce(res({}, { ok: false, status: 500 }));
    await expect(fetchCgePagoInfo("acc", "soc")).rejects.toThrow("CGE getPagoInfo failed: 500");
  });

  it("throws when code != 0", async () => {
    fetchMock.mockResolvedValueOnce(res({ code: 3, message: "nope" }));
    await expect(fetchCgePagoInfo("acc", "soc")).rejects.toThrow("CGE getPagoInfo error: nope");
  });

  it("throws with 'Unknown' when code != 0 and no message", async () => {
    fetchMock.mockResolvedValueOnce(res({ code: 9 }));
    await expect(fetchCgePagoInfo("acc", "soc")).rejects.toThrow("CGE getPagoInfo error: Unknown");
  });

  it("returns parsed current/overdue debt", async () => {
    fetchMock.mockResolvedValueOnce(
      res({ code: 0, deudaActual: { BETRW: "1500" }, deudaVencida: { BETRW: 200 } })
    );
    const r = await fetchCgePagoInfo("acc", "soc");
    expect(r.currentDebt).toBe(1500);
    expect(r.overdueDebt).toBe(200);
  });

  it("defaults debts to 0 when absent", async () => {
    fetchMock.mockResolvedValueOnce(res({ code: 0 }));
    const r = await fetchCgePagoInfo("acc", "soc");
    expect(r.currentDebt).toBe(0);
    expect(r.overdueDebt).toBe(0);
  });
});

describe("fetchCgeConsumoHistorico", () => {
  it("throws when the HTTP response is not ok", async () => {
    fetchMock.mockResolvedValueOnce(res({}, { ok: false, status: 500 }));
    await expect(fetchCgeConsumoHistorico("acc")).rejects.toThrow(
      "CGE consumo histórico failed: 500"
    );
  });

  it("returns the raw json passthrough on success", async () => {
    const payload = { item: [{ CONSUMO_KWH: 100 }] };
    fetchMock.mockResolvedValueOnce(res(payload));
    expect(await fetchCgeConsumoHistorico("acc")).toEqual(payload);
  });
});

// ─── Medipass fetcher ─────────────────────────────────────────────────────────

describe("fetchMedipassBill", () => {
  it("throws when the HTTP response is not ok", async () => {
    fetchMock.mockResolvedValueOnce(res({}, { ok: false, status: 500 }));
    await expect(fetchMedipassBill("rut")).rejects.toThrow("Medipass request failed: 500");
  });

  it("sums pendientes, returns earliest due date and maps rows", async () => {
    fetchMock.mockResolvedValueOnce(
      res({
        data: {
          rows: [
            {
              estado_pago: 0,
              estado_pago_desc: "Pendiente",
              fecha_deuda: "2026-05-20",
              folio: 11,
              monto: "1000",
            },
            {
              estado_pago: 0,
              estado_pago_desc: "Pendiente",
              fecha_deuda: "2026-03-10",
              folio: 12,
              monto: 500,
            },
            {
              estado_pago: 1,
              estado_pago_desc: "Pagado",
              fecha_deuda: "2026-01-01",
              folio: 13,
              monto: 9999,
            },
          ],
        },
      })
    );

    const r = await fetchMedipassBill("rut");
    expect(r.currentDebt).toBe(1500); // only the two pendientes
    expect(r.dueDate).toBe("2026-03-10"); // earliest among pendientes
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toEqual({
      estado: "Pendiente",
      fechaDeuda: "2026-05-20",
      folio: 11,
      monto: 1000,
      pendiente: true,
    });
    expect(r.rows[2].pendiente).toBe(false);
  });

  it("handles an empty/absent rows array", async () => {
    fetchMock.mockResolvedValueOnce(res({ estado: 0 }));
    const r = await fetchMedipassBill("rut");
    expect(r.currentDebt).toBe(0);
    expect(r.dueDate).toBeNull();
    expect(r.rows).toEqual([]);
  });

  it("sends the default API key in the Authorization header", async () => {
    fetchMock.mockResolvedValueOnce(res({ data: { rows: [] } }));
    await fetchMedipassBill("rut-9");
    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers.Authorization).toBe("KNM1ypl0tqtu04X3hE6Es6bsxOvXqdJteB0ObbD1");
    expect(init.headers["X-Api-Key"]).toBe(init.headers.Authorization);
  });
});

// ─── UtilityAccount CRUD ──────────────────────────────────────────────────────

function rawAccount(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    provider: "ESSBIO",
    serviceNumber: "svc",
    label: "L",
    lastAmount: null,
    lastPreviousAmount: null,
    ...over,
  } as unknown as RawAccount;
}

describe("listUtilityAccounts", () => {
  it("builds an empty where + sort order when no filters given", async () => {
    mockAccountFindMany.mockResolvedValueOnce([]);
    await listUtilityAccounts({});
    expect(mockAccountFindMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ provider: "asc" }, { label: "asc" }],
    });
  });

  it("includes each filter only when provided", async () => {
    mockAccountFindMany.mockResolvedValueOnce([]);
    await listUtilityAccounts({ isActive: false, provider: "CGE", scope: "PERSONAL" });
    expect(mockAccountFindMany).toHaveBeenCalledWith({
      where: { isActive: false, provider: "CGE", scope: "PERSONAL" },
      orderBy: [{ provider: "asc" }, { label: "asc" }],
    });
  });

  it("maps Decimal amounts through mapAccount", async () => {
    mockAccountFindMany.mockResolvedValueOnce([
      rawAccount({ lastAmount: new Decimal("100"), lastPreviousAmount: new Decimal("50") }),
    ]);
    const r = await listUtilityAccounts({});
    expect(r[0].lastAmount).toBe(100);
    expect(r[0].lastPreviousAmount).toBe(50);
  });
});

describe("createUtilityAccount", () => {
  it("applies defaults (isActive true, scope PERSONAL, nulls) and maps result", async () => {
    mockAccountCreate.mockResolvedValueOnce(rawAccount());
    await createUtilityAccount({ provider: "ESSBIO", serviceNumber: "svc" });
    expect(mockAccountCreate).toHaveBeenCalledWith({
      data: {
        expenseServiceId: null,
        externalAccountId: null,
        isActive: true,
        label: null,
        notes: null,
        provider: "ESSBIO",
        scope: "PERSONAL",
        serviceNumber: "svc",
      },
    });
  });

  it("passes provided values through (no default override)", async () => {
    mockAccountCreate.mockResolvedValueOnce(rawAccount());
    await createUtilityAccount({
      provider: "CGE",
      serviceNumber: "n",
      isActive: false,
      scope: "BIOALERGIA",
      label: "Casa",
      notes: "nota",
      expenseServiceId: 5,
      externalAccountId: "ext",
    });
    expect(mockAccountCreate).toHaveBeenCalledWith({
      data: {
        expenseServiceId: 5,
        externalAccountId: "ext",
        isActive: false,
        label: "Casa",
        notes: "nota",
        provider: "CGE",
        scope: "BIOALERGIA",
        serviceNumber: "n",
      },
    });
  });
});

describe("updateUtilityAccount", () => {
  it("targets the row by id and applies defaults", async () => {
    mockAccountUpdate.mockResolvedValueOnce(rawAccount());
    await updateUtilityAccount(42, { provider: "ESSBIO", serviceNumber: "svc" });
    expect(mockAccountUpdate).toHaveBeenCalledWith({
      where: { id: 42 },
      data: {
        expenseServiceId: null,
        externalAccountId: null,
        isActive: true,
        label: null,
        notes: null,
        provider: "ESSBIO",
        scope: "PERSONAL",
        serviceNumber: "svc",
      },
    });
  });
});

describe("deleteUtilityAccount", () => {
  it("deletes by id", async () => {
    mockAccountDelete.mockResolvedValueOnce(undefined);
    await deleteUtilityAccount(9);
    expect(mockAccountDelete).toHaveBeenCalledWith({ where: { id: 9 } });
  });
});

// ─── ingestEssbioHistory (dedupe + first-flag) ────────────────────────────────

describe("ingestEssbioHistory", () => {
  const entry = (folio: string, period = "05/2026") => ({
    consumption: 10,
    folio,
    period,
    reading: 100,
    total: 20000,
  });

  it("imports new entries and sets dueDate only on the first one", async () => {
    mockSnapshotFindFirst.mockResolvedValue(null); // nothing existing
    mockSnapshotCreate.mockResolvedValue(undefined);

    const r = await ingestEssbioHistory(
      7,
      [entry("A", "05/2026"), entry("B", "04/2026")],
      "2026-06-01"
    );

    expect(r).toEqual({ imported: 2, skipped: 0, total: 2 });
    expect(mockSnapshotCreate).toHaveBeenCalledTimes(2);
    const first = mockSnapshotCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    const second = mockSnapshotCreate.mock.calls[1][0] as { data: Record<string, unknown> };
    expect(first.data.dueDate).toBe("2026-06-01");
    expect(first.data.emissionDate).toBe("2026-05-01");
    expect(first.data.folio).toBe("A");
    expect(second.data.dueDate).toBeNull(); // not the first
  });

  it("skips entries whose folio already has a snapshot", async () => {
    mockSnapshotFindFirst
      .mockResolvedValueOnce({ id: 1 }) // A exists
      .mockResolvedValueOnce(null); // B new
    mockSnapshotCreate.mockResolvedValue(undefined);

    const r = await ingestEssbioHistory(7, [entry("A"), entry("B")], null);
    expect(r).toEqual({ imported: 1, skipped: 1, total: 2 });
    expect(mockSnapshotCreate).toHaveBeenCalledTimes(1);
  });

  it("does not set dueDate on the first entry when it is skipped (existing)", async () => {
    mockSnapshotFindFirst
      .mockResolvedValueOnce({ id: 1 }) // first skipped
      .mockResolvedValueOnce(null); // second new → first flag already false
    mockSnapshotCreate.mockResolvedValue(undefined);

    await ingestEssbioHistory(7, [entry("A"), entry("B")], "2026-06-01");
    const created = mockSnapshotCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(created.data.dueDate).toBeNull();
  });

  it("returns zeroed counts for an empty list", async () => {
    expect(await ingestEssbioHistory(7, [], null)).toEqual({ imported: 0, skipped: 0, total: 0 });
    expect(mockSnapshotCreate).not.toHaveBeenCalled();
  });
});

// ─── importEssbioHistory guards (DomainError) ─────────────────────────────────

describe("importEssbioHistory", () => {
  it("throws NOT_FOUND when the account does not exist", async () => {
    mockAccountFindFirst.mockResolvedValueOnce(null);
    await expect(importEssbioHistory(5)).rejects.toMatchObject({
      constructor: DomainError,
      kind: "NOT_FOUND",
      message: "UtilityAccount 5 no existe",
    });
  });

  it("throws BAD_REQUEST when the provider is not ESSBIO", async () => {
    mockAccountFindFirst.mockResolvedValueOnce(rawAccount({ provider: "CGE" }));
    const err = await importEssbioHistory(5).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).kind).toBe("BAD_REQUEST");
    expect((err as DomainError).message).toBe("importEssbioHistory solo aplica a ESSBIO, no CGE");
  });

  it("throws BAD_REQUEST when externalAccountId is missing", async () => {
    mockAccountFindFirst.mockResolvedValueOnce(
      rawAccount({ provider: "ESSBIO", externalAccountId: null })
    );
    const err = await importEssbioHistory(5).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).kind).toBe("BAD_REQUEST");
  });

  it("fetches history and delegates to ingest on the happy path", async () => {
    mockAccountFindFirst.mockResolvedValueOnce(
      rawAccount({ provider: "ESSBIO", externalAccountId: "ext-1", serviceNumber: "svc-1" })
    );
    fetchMock.mockResolvedValueOnce(
      res([{ FOLIO: "SII-1", CONSUMO: 1, FECFAC: "05/2026", LECTURA: 2, TOTBOL: 3 }])
    );
    mockSnapshotFindFirst.mockResolvedValue(null);
    mockSnapshotCreate.mockResolvedValue(undefined);

    const r = await importEssbioHistory(5);
    expect(r).toEqual({ imported: 1, skipped: 0, total: 1 });
  });
});

// ─── importCgeConsumoHistory guards + dedupe ──────────────────────────────────

describe("importCgeConsumoHistory", () => {
  it("throws NOT_FOUND when the account does not exist", async () => {
    mockAccountFindFirst.mockResolvedValueOnce(null);
    const err = await importCgeConsumoHistory(3).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).kind).toBe("NOT_FOUND");
  });

  it("throws BAD_REQUEST when the provider is not CGE", async () => {
    mockAccountFindFirst.mockResolvedValueOnce(rawAccount({ provider: "ESSBIO" }));
    const err = await importCgeConsumoHistory(3).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).kind).toBe("BAD_REQUEST");
    expect((err as DomainError).message).toBe(
      "importCgeConsumoHistory solo aplica a CGE, no ESSBIO"
    );
  });

  it("imports consumo items with synthetic folio + derived period/emissionDate", async () => {
    mockAccountFindFirst.mockResolvedValueOnce(
      rawAccount({ provider: "CGE", serviceNumber: "acc-cge" })
    );
    fetchMock.mockResolvedValueOnce(
      res({
        item: [{ CONSUMO_KWH: "250", FECHA_INICIO: "20260401", FECHA_FIN: "20260430" }],
      })
    );
    mockSnapshotFindFirst.mockResolvedValueOnce(null);
    mockSnapshotCreate.mockResolvedValueOnce(undefined);

    const r = await importCgeConsumoHistory(3);
    expect(r).toEqual({ imported: 1, skipped: 0, total: 1 });
    // dedupe lookup scoped to (synthetic folio, account)
    expect(mockSnapshotFindFirst).toHaveBeenCalledWith({
      where: { folio: "CGE-20260401-20260430", utilityAccountId: 3 },
    });
    const created = mockSnapshotCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(created.data.folio).toBe("CGE-20260401-20260430");
    expect(created.data.emissionDate).toBe("2026-04-30");
    expect(created.data.period).toBe("04/2026");
    expect(created.data.consumption).toBe(250);
    expect(created.data.source).toBe("CGE_CONSUMO");
  });

  it("skips items whose synthetic folio already exists", async () => {
    mockAccountFindFirst.mockResolvedValueOnce(rawAccount({ provider: "CGE" }));
    fetchMock.mockResolvedValueOnce(
      res({ item: [{ CONSUMO_KWH: 1, FECHA_INICIO: "20260101", FECHA_FIN: "20260131" }] })
    );
    mockSnapshotFindFirst.mockResolvedValueOnce({ id: 1 });

    const r = await importCgeConsumoHistory(3);
    expect(r).toEqual({ imported: 0, skipped: 1, total: 1 });
    expect(mockSnapshotCreate).not.toHaveBeenCalled();
  });

  it("returns zeroed counts when item is not an array", async () => {
    mockAccountFindFirst.mockResolvedValueOnce(rawAccount({ provider: "CGE" }));
    fetchMock.mockResolvedValueOnce(res({}));
    expect(await importCgeConsumoHistory(3)).toEqual({ imported: 0, skipped: 0, total: 0 });
  });
});

// ─── refreshUtilityAccount ────────────────────────────────────────────────────

describe("refreshUtilityAccount", () => {
  it("returns null when the account does not exist", async () => {
    mockAccountFindFirst.mockResolvedValueOnce(null);
    expect(await refreshUtilityAccount(1)).toBeNull();
  });

  it("persists a snapshot + updates the account on success (ESSBIO)", async () => {
    mockAccountFindFirst.mockResolvedValueOnce(
      rawAccount({ provider: "ESSBIO", serviceNumber: "svc" })
    );
    // fetchEssbioBill then fetchEssbioDueDate
    fetchMock
      .mockResolvedValueOnce(res({ deuda: 5000, saldoanterior: 4000, direccion: "Dir" }))
      .mockResolvedValueOnce(res({ EError: "0", EFecha: "18/05/2026" }));
    mockSnapshotCreate.mockResolvedValueOnce(undefined);
    mockAccountUpdate.mockResolvedValueOnce(rawAccount({ lastAmount: new Decimal("5000") }));

    const r = await refreshUtilityAccount(1, "MANUAL");
    expect(mockSnapshotCreate).toHaveBeenCalledTimes(1);
    expect(mockAccountUpdate).toHaveBeenCalledTimes(1);
    expect(r?.bill.currentAmount).toBe(5000);
    expect(r?.bill.dueDate).toBe("2026-05-18");
    const snap = mockSnapshotCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(snap.data.source).toBe("MANUAL");
    expect(snap.data.utilityAccountId).toBe(1);
  });

  it("writes an error snapshot and rethrows when the fetch fails", async () => {
    mockAccountFindFirst.mockResolvedValueOnce(
      rawAccount({ provider: "ESSBIO", serviceNumber: "svc" })
    );
    fetchMock.mockResolvedValueOnce(res({}, { ok: false, status: 500 }));
    mockSnapshotCreate.mockResolvedValueOnce(undefined);

    await expect(refreshUtilityAccount(1, "CRON")).rejects.toThrow("Essbio request failed: 500");
    const snap = mockSnapshotCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(snap.data.errorMessage).toBe("Essbio request failed: 500");
    expect(snap.data.source).toBe("CRON");
    expect(mockAccountUpdate).not.toHaveBeenCalled();
  });

  it("propagates a DomainError for an unsupported provider", async () => {
    mockAccountFindFirst.mockResolvedValueOnce(rawAccount({ provider: "MOVISTAR" }));
    mockSnapshotCreate.mockResolvedValueOnce(undefined);
    const err = await refreshUtilityAccount(1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).message).toBe("No scraper implemented for provider: MOVISTAR");
  });

  it("maps a CGE bill incl. getPagoInfo overdue observation", async () => {
    mockAccountFindFirst.mockResolvedValueOnce(
      rawAccount({ provider: "CGE", serviceNumber: "cc" })
    );
    fetchMock
      .mockResolvedValueOnce(
        res({
          code: 0,
          edatosCupon: {
            ultBoleta: "3000",
            antBoleta: "2000",
            terBoleta: "1000",
            empresa: "CGE",
            fecEmision: "2026-05-01",
          },
        })
      )
      .mockResolvedValueOnce(
        res({ code: 0, deudaActual: { BETRW: 500 }, deudaVencida: { BETRW: 100 } })
      );
    mockSnapshotCreate.mockResolvedValueOnce(undefined);
    mockAccountUpdate.mockResolvedValueOnce(rawAccount({ id: 1 }));

    const r = await refreshUtilityAccount(1);
    expect(r?.bill.currentAmount).toBe(3000);
    expect(r?.bill.currentDebt).toBe(500);
    expect(r?.bill.thirdAmount).toBe(1000);
    expect(r?.bill.emissionDate).toBe("2026-05-01");
    expect(r?.bill.observation).toContain("Deuda vencida");
  });

  it("falls back to coupon-only debt when CGE getPagoInfo fails (fail-soft)", async () => {
    mockAccountFindFirst.mockResolvedValueOnce(
      rawAccount({ provider: "CGE", serviceNumber: "cc" })
    );
    fetchMock
      .mockResolvedValueOnce(res({ code: 0, edatosCupon: { ultBoleta: "3000", empresa: "CGE" } }))
      .mockResolvedValueOnce(res({}, { ok: false, status: 500 })); // getPagoInfo dies
    mockSnapshotCreate.mockResolvedValueOnce(undefined);
    mockAccountUpdate.mockResolvedValueOnce(rawAccount({ id: 1 }));

    const r = await refreshUtilityAccount(1);
    expect(r?.bill.currentAmount).toBe(3000);
    expect(r?.bill.currentDebt).toBeNull(); // getPagoInfo failed → stays null
    expect(r?.bill.observation).toBeNull();
  });

  it("maps a MEDIPASS bill with pending observation", async () => {
    mockAccountFindFirst.mockResolvedValueOnce(
      rawAccount({ provider: "MEDIPASS", serviceNumber: "rut" })
    );
    fetchMock.mockResolvedValueOnce(
      res({
        data: {
          rows: [{ estado_pago: 0, monto: 1000, fecha_deuda: "2026-05-01", folio: 1 }],
        },
      })
    );
    mockSnapshotCreate.mockResolvedValueOnce(undefined);
    mockAccountUpdate.mockResolvedValueOnce(rawAccount({ id: 1 }));

    const r = await refreshUtilityAccount(1);
    expect(r?.bill.currentAmount).toBe(1000);
    expect(r?.bill.dueDate).toBe("2026-05-01");
    expect(r?.bill.observation).toBe("1 cobro(s) pendiente(s)");
  });

  it("MEDIPASS with no pending rows reports 'Sin deuda pendiente'", async () => {
    mockAccountFindFirst.mockResolvedValueOnce(
      rawAccount({ provider: "MEDIPASS", serviceNumber: "rut" })
    );
    fetchMock.mockResolvedValueOnce(
      res({ data: { rows: [{ estado_pago: 1, monto: 500, folio: 2 }] } })
    );
    mockSnapshotCreate.mockResolvedValueOnce(undefined);
    mockAccountUpdate.mockResolvedValueOnce(rawAccount({ id: 1 }));

    const r = await refreshUtilityAccount(1);
    expect(r?.bill.currentAmount).toBe(0);
    expect(r?.bill.observation).toBe("Sin deuda pendiente");
  });
});

// ─── refreshAllActiveUtilityAccounts ──────────────────────────────────────────

describe("refreshAllActiveUtilityAccounts", () => {
  it("returns a success row per active account and captures per-account errors", async () => {
    // findMany(active) → 2 accounts
    mockAccountFindMany.mockResolvedValueOnce([
      rawAccount({ id: 1, provider: "ESSBIO", serviceNumber: "ok" }),
      rawAccount({ id: 2, provider: "MOVISTAR", serviceNumber: "bad" }),
    ]);
    // account 1: refresh re-reads via findFirst → success
    mockAccountFindFirst
      .mockResolvedValueOnce(rawAccount({ id: 1, provider: "ESSBIO", serviceNumber: "ok" }))
      // account 2: findFirst → MOVISTAR → unsupported provider throws
      .mockResolvedValueOnce(rawAccount({ id: 2, provider: "MOVISTAR", serviceNumber: "bad" }));
    fetchMock
      .mockResolvedValueOnce(res({ deuda: 1 })) // essbio bill (acct 1)
      .mockResolvedValueOnce(res({ EError: "1" })); // essbio due date (acct 1) → null
    mockSnapshotCreate.mockResolvedValue(undefined);
    mockAccountUpdate.mockResolvedValueOnce(rawAccount({ id: 1 }));

    const r = await refreshAllActiveUtilityAccounts();
    expect(mockAccountFindMany).toHaveBeenCalledWith({ where: { isActive: true } });
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ accountId: 1, error: null, serviceNumber: "ok", success: true });
    expect(r[1].accountId).toBe(2);
    expect(r[1].success).toBe(false);
    expect(r[1].error).toContain("No scraper implemented");
    // source "CRON" is threaded into the snapshot of the successful account
    const sources = mockSnapshotCreate.mock.calls.map(
      (c) => (c[0] as { data: { source: string } }).data.source
    );
    expect(sources).toContain("CRON");
  });
});
