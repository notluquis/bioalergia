import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-123";

const { processReport } = vi.hoisted(() => ({
  processReport: vi.fn(),
}));

vi.mock("../../services/mercadopago", () => ({
  MP_WEBHOOK_PASSWORD: "test-secret-123",
  MercadoPagoService: {
    processReport,
  },
  isSettlementReport: (...inputs: Array<string | undefined | null>) => {
    const haystack = inputs.filter(Boolean).join(" ").toLowerCase();
    return [
      "settlement",
      "liquidaci",
      "account_money",
      "all_transactions",
      "todas_las_transacciones",
      "todas-las-transacciones",
    ].some((hint) => haystack.includes(hint));
  },
}));

vi.mock("../../lib/logger", () => ({
  logEvent: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { mercadopagoReportWebhookRoutes } from "../mercadopago-report-webhook.ts";

function buildPayload(overrides: Record<string, unknown> = {}) {
  const transaction_id = "tx-001";
  const generation_date = "2026-05-08T12:00:00Z";
  const signature = bcrypt.hashSync(`${transaction_id}-${SECRET}-${generation_date}`, 4);
  return {
    transaction_id,
    request_date: "2026-05-08T11:00:00Z",
    generation_date,
    files: [{ name: "release-2026-05.csv", url: "https://example.com/file.csv", type: ".csv" }],
    status: "ready",
    creation_type: "manual",
    report_type: "release",
    is_test: false,
    signature,
    ...overrides,
  };
}

async function post(body: unknown) {
  return mercadopagoReportWebhookRoutes.request("/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const flush = () => new Promise((r) => setTimeout(r, 10));

describe("MercadoPago report webhook", () => {
  beforeEach(() => {
    processReport.mockReset();
    processReport.mockResolvedValue({
      inserted: 0,
      updated: 0,
      skipped: 0,
      excluded: 0,
      errors: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
  });

  it("rejects missing transaction_id with 400", async () => {
    const payload = buildPayload();
    const { transaction_id: _omit, ...rest } = payload;
    const res = await post(rest);
    expect(res.status).toBe(400);
  });

  it("rejects missing generation_date with 400", async () => {
    const payload = buildPayload();
    const { generation_date: _omit, ...rest } = payload;
    const res = await post(rest);
    expect(res.status).toBe(400);
  });

  it("rejects invalid signature with 401", async () => {
    const payload = buildPayload({
      signature: "$2b$04$invalidhashvalue..................................",
    });
    const res = await post(payload);
    expect(res.status).toBe(401);
  });

  it("rejects wrong-secret signature with 401", async () => {
    const payload = buildPayload();
    payload.signature = bcrypt.hashSync(
      `${payload.transaction_id}-other-secret-${payload.generation_date}`,
      4
    );
    const res = await post(payload);
    expect(res.status).toBe(401);
  });

  it("accepts valid signature with 202 and ingests file", async () => {
    const res = await post(buildPayload());
    expect(res.status).toBe(202);
    await flush();
    expect(processReport).toHaveBeenCalledOnce();
    expect(processReport).toHaveBeenCalledWith("release", { url: "https://example.com/file.csv" });
  });

  it("skips processing when is_test=true", async () => {
    const res = await post(buildPayload({ is_test: true }));
    expect(res.status).toBe(202);
    await flush();
    expect(processReport).not.toHaveBeenCalled();
  });

  it("does not call processReport when files array is empty", async () => {
    const res = await post(buildPayload({ files: [] }));
    expect(res.status).toBe(202);
    await flush();
    expect(processReport).not.toHaveBeenCalled();
  });

  it("filters out files missing name or url", async () => {
    const res = await post(
      buildPayload({
        files: [
          { name: "ok.csv", url: "https://example.com/ok.csv", type: ".csv" },
          { name: "no-url.csv", type: ".csv" },
          { url: "https://example.com/no-name.csv", type: ".csv" },
        ],
      })
    );
    expect(res.status).toBe(202);
    await flush();
    expect(processReport).toHaveBeenCalledOnce();
    expect(processReport).toHaveBeenCalledWith("release", { url: "https://example.com/ok.csv" });
  });

  it("skips non-csv files (xlsx) but still 202", async () => {
    const res = await post(
      buildPayload({
        files: [{ name: "report.xlsx", url: "https://example.com/r.xlsx", type: ".xlsx" }],
      })
    );
    expect(res.status).toBe(202);
    await flush();
    expect(processReport).not.toHaveBeenCalled();
  });

  it.each([
    ["settlement", "settlement"],
    ["settlement_v2", "settlement"],
    ["account_money", "settlement"],
    ["all_transactions", "settlement"],
    ["liquidaciones", "settlement"],
    ["release", "release"],
    ["released_money", "release"],
    ["", "release"],
  ])("routes report_type %s -> %s table", async (input, expected) => {
    await post(buildPayload({ report_type: input }));
    await flush();
    expect(processReport).toHaveBeenCalledWith(expected, expect.any(Object));
  });

  it("returns 503 when MP_WEBHOOK_PASSWORD is empty", async () => {
    vi.resetModules();
    vi.doMock("../../services/mercadopago", () => ({
      MP_WEBHOOK_PASSWORD: "",
      MercadoPagoService: { processReport: vi.fn() },
      isSettlementReport: () => false,
    }));
    vi.doMock("../../lib/logger", () => ({
      logEvent: vi.fn(),
      logWarn: vi.fn(),
      logError: vi.fn(),
    }));

    const mod = await import("../mercadopago-report-webhook.ts");
    const res = await mod.mercadopagoReportWebhookRoutes.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    expect(res.status).toBe(503);
  });
});
