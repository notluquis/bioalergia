import bcrypt from "bcryptjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-123";

const { settingsStore, runAutoSync } = vi.hoisted(() => ({
  settingsStore: new Map<string, string>(),
  runAutoSync: vi.fn(),
}));

vi.mock("../../services/mercadopago", () => ({
  MP_WEBHOOK_PASSWORD: "test-secret-123",
}));

vi.mock("../../services/settings", () => ({
  getSetting: vi.fn(async (key: string) => settingsStore.get(key) ?? null),
  updateSetting: vi.fn(async (key: string, value: string) => {
    settingsStore.set(key, value);
  }),
}));

vi.mock("../../lib/mercadopago/mercadopago-scheduler", () => ({
  runMercadoPagoAutoSync: runAutoSync,
}));

vi.mock("../../lib/logger", () => ({
  logEvent: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { mercadopagoReportWebhookRoutes } from "../mercadopago-report-webhook";

const PENDING_KEY = "mp:webhook:pending";

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

describe("MercadoPago report webhook", () => {
  beforeEach(() => {
    settingsStore.clear();
    runAutoSync.mockReset();
    runAutoSync.mockResolvedValue(undefined);
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
    const payload = buildPayload({ signature: "$2b$04$invalidhashvalue.................................." });
    const res = await post(payload);
    expect(res.status).toBe(401);
  });

  it("rejects wrong-secret signature with 401", async () => {
    const payload = buildPayload();
    payload.signature = bcrypt.hashSync(`${payload.transaction_id}-other-secret-${payload.generation_date}`, 4);
    const res = await post(payload);
    expect(res.status).toBe(401);
  });

  it("accepts valid signature with 202 and enqueues file", async () => {
    const res = await post(buildPayload());
    expect(res.status).toBe(202);

    // Wait microtasks: enqueue runs in fire-and-forget
    await new Promise((r) => setTimeout(r, 10));

    const stored = settingsStore.get(PENDING_KEY);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored ?? "[]");
    expect(parsed).toHaveLength(1);
    expect(parsed[0].transaction_id).toBe("tx-001");
    expect(parsed[0].files[0].name).toBe("release-2026-05.csv");
    expect(runAutoSync).toHaveBeenCalledOnce();
  });

  it("skips processing when is_test=true", async () => {
    const res = await post(buildPayload({ is_test: true }));
    expect(res.status).toBe(202);
    await new Promise((r) => setTimeout(r, 10));
    expect(settingsStore.get(PENDING_KEY)).toBeUndefined();
    expect(runAutoSync).not.toHaveBeenCalled();
  });

  it("dedupes by transaction_id", async () => {
    await post(buildPayload());
    await new Promise((r) => setTimeout(r, 10));
    await post(buildPayload());
    await new Promise((r) => setTimeout(r, 10));

    const stored = settingsStore.get(PENDING_KEY);
    const parsed = JSON.parse(stored ?? "[]");
    expect(parsed).toHaveLength(1);
  });

  it("does not enqueue when files array is empty", async () => {
    const res = await post(buildPayload({ files: [] }));
    expect(res.status).toBe(202);
    await new Promise((r) => setTimeout(r, 10));
    expect(settingsStore.get(PENDING_KEY)).toBeUndefined();
  });

  it("filters out files missing name or url", async () => {
    const res = await post(
      buildPayload({
        files: [
          { name: "ok.csv", url: "https://example.com/ok.csv", type: ".csv" },
          { name: "no-url.csv", type: ".csv" },
          { url: "https://example.com/no-name.csv", type: ".csv" },
        ],
      }),
    );
    expect(res.status).toBe(202);
    await new Promise((r) => setTimeout(r, 10));

    const parsed = JSON.parse(settingsStore.get(PENDING_KEY) ?? "[]");
    expect(parsed[0].files).toHaveLength(1);
    expect(parsed[0].files[0].name).toBe("ok.csv");
  });

  it("returns 503 when MP_WEBHOOK_PASSWORD is empty", async () => {
    vi.resetModules();
    vi.doMock("../../services/mercadopago", () => ({ MP_WEBHOOK_PASSWORD: "" }));
    vi.doMock("../../services/settings", () => ({
      getSetting: vi.fn(),
      updateSetting: vi.fn(),
    }));
    vi.doMock("../../lib/mercadopago/mercadopago-scheduler", () => ({
      runMercadoPagoAutoSync: vi.fn(),
    }));
    vi.doMock("../../lib/logger", () => ({
      logEvent: vi.fn(),
      logWarn: vi.fn(),
      logError: vi.fn(),
    }));

    const mod = await import("../mercadopago-report-webhook");
    const res = await mod.mercadopagoReportWebhookRoutes.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    expect(res.status).toBe(503);
  });
});
