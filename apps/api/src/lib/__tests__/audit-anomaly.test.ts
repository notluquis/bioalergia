import { beforeEach, describe, expect, it, vi } from "vitest";

// Tests for breach/anomaly detection (lib/audit-anomaly.ts):
//  - a threshold breach (mass-read) triggers emitSecurityAlert + AuditLog row.
//  - under threshold: no alert.
//  - thresholds come from getSetting (config-driven) — we drive them via mock.
//
// We mock @finanzas/db kysely passthrough + the `sql` tagged template, routing
// each query's result by matching the static text (CLINICAL_RECORD_READ →
// mass-read rows, etc.), and mock getSetting / emitSecurityAlert / audit-log.

const { sqlRows } = vi.hoisted(() => ({
  // Keyed result rows per detector, matched against the rendered SQL text.
  sqlRows: {
    massRead: [] as Array<{ user_id: number | null; n: number }>,
    offHours: [] as Array<{ user_id: number | null; n: number }>,
    bulkExport: [] as Array<{ user_id: number | null; n: number }>,
    failedAuth: [] as Array<{ ip: string | null; n: number }>,
    lockout: [] as Array<{ n: number }>,
  },
}));

vi.mock("@finanzas/db", () => ({ db: {}, kysely: {} }));

vi.mock("kysely", () => {
  function render(strings: TemplateStringsArray): string {
    return strings.join(" ").replace(/\s+/g, " ").toUpperCase();
  }
  const sql = (strings: TemplateStringsArray, ..._vals: unknown[]) => {
    const text = strings ? render(strings) : "";
    return {
      execute: async () => {
        if (text.includes("KIND = 'CLINICAL_RECORD_READ'")) return { rows: sqlRows.massRead };
        if (text.includes("CLINICAL_DOCUMENT_VIEW")) return { rows: sqlRows.offHours };
        if (text.includes("KIND = 'DATA_EXPORT'")) return { rows: sqlRows.bulkExport };
        if (text.includes("LOGIN_FAILURE")) return { rows: sqlRows.failedAuth };
        if (text.includes("LOGIN_LOCKED")) return { rows: sqlRows.lockout };
        return { rows: [] };
      },
    };
  };
  sql.table = (n: string) => ({ __ident: n });
  sql.ref = (n: string) => ({ __ident: n });
  sql.lit = (v: unknown) => ({ __lit: v });
  sql.join = (a: unknown[]) => ({ __join: a });
  return { sql };
});

const { getSettingMock, emitMock, auditMock } = vi.hoisted(() => ({
  getSettingMock: vi.fn(),
  emitMock: vi.fn(),
  auditMock: vi.fn(),
}));

vi.mock("../settings.ts", () => ({ getSetting: getSettingMock }));
vi.mock("../security-alerts.ts", () => ({ emitSecurityAlert: emitMock }));
vi.mock("../audit-log.ts", () => ({ logAuditEvent: auditMock }));

import { runAuditAnomaly } from "../audit-anomaly.ts";

beforeEach(() => {
  vi.clearAllMocks();
  sqlRows.massRead = [];
  sqlRows.offHours = [];
  sqlRows.bulkExport = [];
  sqlRows.failedAuth = [];
  sqlRows.lockout = [];
  // All settings null → code defaults (massReadPerHour=50, windowMinutes=60).
  getSettingMock.mockResolvedValue(null);
  emitMock.mockResolvedValue({ delivered: true, recipients: 1 });
});

describe("runAuditAnomaly", () => {
  it("mass-read above threshold triggers emitSecurityAlert + AuditLog", async () => {
    // window=60min, threshold scales to 50; 120 reads by user 7 breaches it.
    sqlRows.massRead = [{ user_id: 7, n: 120 }];

    const report = await runAuditAnomaly();

    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].kind).toBe("mass_read");
    expect(report.findings[0].scope).toBe("user:7");
    expect(report.alertsEmitted).toBe(1);

    expect(emitMock).toHaveBeenCalledTimes(1);
    const alert = emitMock.mock.calls[0][0];
    expect(alert.scope).toBe("user:7");
    expect(alert.alertType).toBe("anomaly:mass_read");
    expect(alert.severity).toBe("critical");

    // AuditLog row written for the anomaly.
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock.mock.calls[0][0].kind).toBe("ADMIN_ACTION");
  });

  it("under threshold (no rows returned by detectors) emits no alert", async () => {
    // HAVING in the SQL means no rows come back when under threshold.
    const report = await runAuditAnomaly();

    expect(report.findings).toHaveLength(0);
    expect(report.alertsEmitted).toBe(0);
    expect(emitMock).not.toHaveBeenCalled();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("respects config-driven thresholds via getSetting", async () => {
    // Lower the window so the per-hour→window scaling is observable; the
    // detector SQL already encodes HAVING, so we just verify getSetting is
    // consulted for the documented keys.
    getSettingMock.mockImplementation(async (key: string) =>
      key === "security.windowMinutes" ? "15" : null
    );
    sqlRows.failedAuth = [{ ip: "1.2.3.4", n: 99 }];

    const report = await runAuditAnomaly();

    expect(report.windowMinutes).toBe(15);
    expect(report.findings.some((f) => f.kind === "failed_auth")).toBe(true);
    expect(getSettingMock).toHaveBeenCalledWith("security.windowMinutes");
    expect(getSettingMock).toHaveBeenCalledWith("security.failedAuthPerHour");
  });

  it("lockout spike over threshold is global-scoped critical", async () => {
    sqlRows.lockout = [{ n: 9 }]; // default lockout threshold = 5

    const report = await runAuditAnomaly();

    const lockout = report.findings.find((f) => f.kind === "lockout_spike");
    expect(lockout).toBeDefined();
    expect(lockout?.scope).toBe("global");
    expect(lockout?.severity).toBe("critical");
  });
});
