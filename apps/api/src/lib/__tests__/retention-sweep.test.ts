import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Tests for the automated PII retention sweep (lib/retention-sweep.ts):
//  - dry-run (flag unset) returns matched counts but NEVER mutates.
//  - clinical/ficha denylisted tables are skipped even with a policy row.
//  - execute mode (flag=1) runs the bounded DELETE/UPDATE.
//
// We mock @finanzas/db (db.dataRetentionPolicy.findMany + kysely passthrough),
// the kysely `sql` tagged template (capturing the SQL "shape" so we can assert
// which statements ran), and lib/audit-log so the summary write is observable.

const { mockDb, sqlState } = vi.hoisted(() => {
  const mockDb = {
    dataRetentionPolicy: { findMany: vi.fn() },
  };
  // Each `.execute()` call records the rendered statement kind (SELECT COUNT /
  // DELETE / UPDATE) and returns the next queued result.
  const sqlState = {
    executed: [] as string[],
    countQueue: [] as number[],
    affectedQueue: [] as bigint[],
  };
  return { mockDb, sqlState };
});

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));

// `sql` is a tagged-template function WITH static helpers (table/ref/lit/join).
// We render the template's static text fragments to classify the statement and
// drive the queued results.
vi.mock("kysely", () => {
  function render(strings: TemplateStringsArray): string {
    return strings.join(" ").replace(/\s+/g, " ").trim().toUpperCase();
  }
  const sql = (strings: TemplateStringsArray, ..._vals: unknown[]) => {
    const text = strings ? render(strings) : "";
    return {
      __text: text,
      execute: async () => {
        sqlState.executed.push(text);
        if (text.includes("COUNT(*)")) {
          const n = sqlState.countQueue.shift() ?? 0;
          return { rows: [{ n }] };
        }
        if (text.startsWith("DELETE") || text.startsWith("UPDATE")) {
          const a = sqlState.affectedQueue.shift() ?? 0n;
          return { numAffectedRows: a, rows: [] };
        }
        return { rows: [] };
      },
    };
  };
  sql.table = (name: string) => ({ __ident: name });
  sql.ref = (name: string) => ({ __ident: name });
  sql.lit = (v: unknown) => ({ __lit: v });
  sql.join = (arr: unknown[]) => ({ __join: arr });
  return { sql };
});

const { auditMock } = vi.hoisted(() => ({ auditMock: vi.fn() }));
vi.mock("../audit-log.ts", () => ({ logAuditEvent: auditMock }));

import { runRetentionSweep } from "../retention-sweep.ts";

beforeEach(() => {
  vi.clearAllMocks();
  sqlState.executed = [];
  sqlState.countQueue = [];
  sqlState.affectedQueue = [];
  delete process.env.DB_RETENTION_SWEEP;
});

afterEach(() => {
  delete process.env.DB_RETENTION_SWEEP;
});

describe("runRetentionSweep", () => {
  it("dry-run (flag unset): counts matched rows but never DELETE/UPDATE", async () => {
    mockDb.dataRetentionPolicy.findMany.mockResolvedValue([
      {
        table: "audit_logs",
        enabled: true,
        action: "delete",
        windowDays: 1095,
        dateColumn: "occurred_at",
        anonymizeMap: {},
      },
    ]);
    sqlState.countQueue = [42];

    const report = await runRetentionSweep();

    expect(report.dryRun).toBe(true);
    expect(report.policiesEvaluated).toBe(1);
    expect(report.totalMatched).toBe(42);
    expect(report.totalAffected).toBe(0);
    // Only the COUNT ran — no DELETE / UPDATE.
    expect(sqlState.executed.some((s) => s.includes("COUNT(*)"))).toBe(true);
    expect(sqlState.executed.some((s) => s.startsWith("DELETE"))).toBe(false);
    expect(sqlState.executed.some((s) => s.startsWith("UPDATE"))).toBe(false);
    // Summary audit row written.
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock.mock.calls[0][0].kind).toBe("ADMIN_ACTION");
  });

  it("never touches a clinical/ficha denylisted table even with a policy row", async () => {
    mockDb.dataRetentionPolicy.findMany.mockResolvedValue([
      {
        table: "clinical_records",
        enabled: true,
        action: "delete",
        windowDays: 30,
        dateColumn: "created_at",
        anonymizeMap: {},
      },
      {
        table: "events",
        enabled: true,
        action: "delete",
        windowDays: 30,
        dateColumn: "created_at",
        anonymizeMap: {},
      },
    ]);
    process.env.DB_RETENTION_SWEEP = "1"; // execute mode — still must NOT touch them

    const report = await runRetentionSweep();

    expect(report.dryRun).toBe(false);
    expect(report.results).toHaveLength(2);
    expect(report.results.every((r) => r.skipped === "denylisted")).toBe(true);
    // No SQL of any kind ran against the denylisted tables.
    expect(sqlState.executed).toHaveLength(0);
    expect(report.totalMatched).toBe(0);
    expect(report.totalAffected).toBe(0);
  });

  it("execute mode (flag=1): runs bounded DELETE and reports affected", async () => {
    mockDb.dataRetentionPolicy.findMany.mockResolvedValue([
      {
        table: "login_attempts",
        enabled: true,
        action: "delete",
        windowDays: 180,
        dateColumn: "created_at",
        anonymizeMap: {},
      },
    ]);
    process.env.DB_RETENTION_SWEEP = "1";
    sqlState.countQueue = [10];
    sqlState.affectedQueue = [10n];

    const report = await runRetentionSweep();

    expect(report.dryRun).toBe(false);
    expect(report.totalMatched).toBe(10);
    expect(report.totalAffected).toBe(10);
    expect(sqlState.executed.some((s) => s.startsWith("DELETE"))).toBe(true);
  });

  it("execute mode anonymize: runs UPDATE when anonymizeMap has valid rules", async () => {
    mockDb.dataRetentionPolicy.findMany.mockResolvedValue([
      {
        table: "wa_messages",
        enabled: true,
        action: "anonymize",
        windowDays: 730,
        dateColumn: "created_at",
        anonymizeMap: { body: { set: "null" }, media_url: { set: "hash" } },
      },
    ]);
    process.env.DB_RETENTION_SWEEP = "1";
    sqlState.countQueue = [5];
    sqlState.affectedQueue = [5n];

    const report = await runRetentionSweep();

    expect(report.totalAffected).toBe(5);
    expect(sqlState.executed.some((s) => s.startsWith("UPDATE"))).toBe(true);
    expect(sqlState.executed.some((s) => s.startsWith("DELETE"))).toBe(false);
  });

  it("skips a policy with an invalid (non-identifier) table name", async () => {
    mockDb.dataRetentionPolicy.findMany.mockResolvedValue([
      {
        table: "audit_logs; DROP TABLE patients",
        enabled: true,
        action: "delete",
        windowDays: 30,
        dateColumn: "created_at",
        anonymizeMap: {},
      },
    ]);
    process.env.DB_RETENTION_SWEEP = "1";

    const report = await runRetentionSweep();

    expect(report.results[0].skipped).toBe("invalid");
    expect(sqlState.executed).toHaveLength(0);
  });
});
