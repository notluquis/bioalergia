import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mocks } = vi.hoisted(() => {
  const mockDb = {
    intakeSubmission: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $setOptions: vi.fn(() => mockDb),
  };
  const mocks = {
    deleteR2Objects: vi.fn(),
    getSetting: vi.fn(),
    logAuditEvent: vi.fn(),
  };
  return { mockDb, mocks };
});
vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));
vi.mock("../../lib/logger.ts", () => ({ logEvent: vi.fn(), logWarn: vi.fn() }));
vi.mock("../../modules/cloudflare/r2.ts", () => ({ deleteR2Objects: mocks.deleteR2Objects }));
vi.mock("../../lib/settings.ts", () => ({ getSetting: mocks.getSetting }));
vi.mock("../../lib/audit-log.ts", () => ({ logAuditEvent: mocks.logAuditEvent }));

import { purgeExpiredIntakeSubmissions, resolveRetentionDays } from "../intake-retention.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

function row(id: string, overrides: Record<string, unknown> = {}) {
  return { id, comprobanteR2Key: null, ...overrides };
}

describe("resolveRetentionDays", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults to 180 when the setting is unset", async () => {
    mocks.getSetting.mockResolvedValue(null);
    expect(await resolveRetentionDays()).toBe(180);
  });

  it("uses a positive integer setting value", async () => {
    mocks.getSetting.mockResolvedValue("  90 ");
    expect(await resolveRetentionDays()).toBe(90);
  });

  it("falls back to 180 for a non-positive / non-numeric setting", async () => {
    mocks.getSetting.mockResolvedValue("0");
    expect(await resolveRetentionDays()).toBe(180);
    mocks.getSetting.mockResolvedValue("abc");
    expect(await resolveRetentionDays()).toBe(180);
  });
});

describe("purgeExpiredIntakeSubmissions", () => {
  const OLD_ENV = process.env.INTAKE_RETENTION_PURGE;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSetting.mockResolvedValue(null); // default 180d window
    mocks.deleteR2Objects.mockResolvedValue(undefined);
    mocks.logAuditEvent.mockResolvedValue(undefined);
    mockDb.intakeSubmission.deleteMany.mockResolvedValue({ count: 0 });
  });

  afterEach(() => {
    if (OLD_ENV == null) delete process.env.INTAKE_RETENTION_PURGE;
    else process.env.INTAKE_RETENTION_PURGE = OLD_ENV;
  });

  it("dry-run (flag off): finds expired rows but deletes NOTHING (no R2, no rows)", async () => {
    delete process.env.INTAKE_RETENTION_PURGE;
    mockDb.intakeSubmission.findMany.mockResolvedValue([
      row("a", { comprobanteR2Key: "intake-comprobante/a" }),
      row("b"),
    ]);

    const report = await purgeExpiredIntakeSubmissions();

    expect(report.dryRun).toBe(true);
    expect(report.windowDays).toBe(180);
    expect(report.matched).toBe(2);
    expect(report.rowsDeleted).toBe(0);
    expect(report.r2KeysDeleted).toBe(0);
    expect(mocks.deleteR2Objects).not.toHaveBeenCalled();
    expect(mockDb.intakeSubmission.deleteMany).not.toHaveBeenCalled();
    // Still audited (dry-run summary).
    expect(mocks.logAuditEvent).toHaveBeenCalledTimes(1);
  });

  it("uses a 180-day cutoff and asks the DB for the oldest rows first, bounded", async () => {
    delete process.env.INTAKE_RETENTION_PURGE;
    mockDb.intakeSubmission.findMany.mockResolvedValue([]);

    const before = Date.now();
    await purgeExpiredIntakeSubmissions();
    const after = Date.now();

    const arg = mockDb.intakeSubmission.findMany.mock.calls[0]?.[0] as {
      where: { submittedAt: { lt: Date } };
      orderBy: { submittedAt: string };
      take: number;
    };
    expect(arg.orderBy).toEqual({ submittedAt: "asc" });
    expect(arg.take).toBe(500);
    const cutoff = arg.where.submittedAt.lt.getTime();
    expect(cutoff).toBeGreaterThanOrEqual(before - 180 * DAY_MS);
    expect(cutoff).toBeLessThanOrEqual(after - 180 * DAY_MS);
  });

  it("flag on: deletes R2 receipts THEN rows (R2 before DB)", async () => {
    process.env.INTAKE_RETENTION_PURGE = "1";
    mockDb.intakeSubmission.findMany.mockResolvedValue([
      row("a", { comprobanteR2Key: "intake-comprobante/a" }),
      row("b", { comprobanteR2Key: "intake-comprobante/b" }),
    ]);
    mockDb.intakeSubmission.deleteMany.mockResolvedValue({ count: 2 });

    const order: string[] = [];
    mocks.deleteR2Objects.mockImplementation(async () => {
      order.push("r2");
    });
    mockDb.intakeSubmission.deleteMany.mockImplementation(async () => {
      order.push("db");
      return { count: 2 };
    });

    const report = await purgeExpiredIntakeSubmissions();

    expect(order).toEqual(["r2", "db"]); // R2 first
    expect(mocks.deleteR2Objects).toHaveBeenCalledWith([
      "intake-comprobante/a",
      "intake-comprobante/b",
    ]);
    expect(mockDb.intakeSubmission.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["a", "b"] } },
    });
    expect(report.dryRun).toBe(false);
    expect(report.rowsDeleted).toBe(2);
    expect(report.r2KeysDeleted).toBe(2);
  });

  it("flag on, rows without a receipt key: deletes rows but makes NO R2 call", async () => {
    process.env.INTAKE_RETENTION_PURGE = "1";
    mockDb.intakeSubmission.findMany.mockResolvedValue([row("a"), row("b")]);
    mockDb.intakeSubmission.deleteMany.mockResolvedValue({ count: 2 });

    const report = await purgeExpiredIntakeSubmissions();

    expect(mocks.deleteR2Objects).not.toHaveBeenCalled();
    expect(report.r2KeysDeleted).toBe(0);
    expect(report.rowsDeleted).toBe(2);
    expect(mockDb.intakeSubmission.deleteMany).toHaveBeenCalledOnce();
  });

  it("no expired rows: no deletes, still emits the audit summary", async () => {
    process.env.INTAKE_RETENTION_PURGE = "1";
    mockDb.intakeSubmission.findMany.mockResolvedValue([]);

    const report = await purgeExpiredIntakeSubmissions();

    expect(report.matched).toBe(0);
    expect(mocks.deleteR2Objects).not.toHaveBeenCalled();
    expect(mockDb.intakeSubmission.deleteMany).not.toHaveBeenCalled();
    expect(mocks.logAuditEvent).toHaveBeenCalledTimes(1);
  });

  it("honors a custom retention window from the setting", async () => {
    delete process.env.INTAKE_RETENTION_PURGE;
    mocks.getSetting.mockResolvedValue("30");
    mockDb.intakeSubmission.findMany.mockResolvedValue([]);

    const before = Date.now();
    const report = await purgeExpiredIntakeSubmissions();
    const after = Date.now();

    expect(report.windowDays).toBe(30);
    const arg = mockDb.intakeSubmission.findMany.mock.calls[0]?.[0] as {
      where: { submittedAt: { lt: Date } };
    };
    const cutoff = arg.where.submittedAt.lt.getTime();
    expect(cutoff).toBeGreaterThanOrEqual(before - 30 * DAY_MS);
    expect(cutoff).toBeLessThanOrEqual(after - 30 * DAY_MS);
  });
});
