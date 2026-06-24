import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    securityAlertState: {
      findMany: vi.fn(),
    },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { listSecurityAlertStates } = await import("../security-alerts-dashboard.ts");

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.securityAlertState.findMany.mockResolvedValue([]);
});

describe("listSecurityAlertStates", () => {
  it("lists states ordered by lastSentAt desc", async () => {
    await listSecurityAlertStates();
    expect(mockDb.securityAlertState.findMany).toHaveBeenCalledWith({
      orderBy: { lastSentAt: "desc" },
    });
  });

  it("wraps the rows under a `states` key", async () => {
    const rows = [
      {
        scope: "global",
        alertType: "audit_chain_tampered",
        lastSentAt: new Date("2026-06-15T10:00:00Z"),
      },
      {
        scope: "user:42",
        alertType: "login_lockout_long",
        lastSentAt: new Date("2026-06-14T09:00:00Z"),
      },
    ];
    mockDb.securityAlertState.findMany.mockResolvedValue(rows);
    const res = await listSecurityAlertStates();
    expect(res).toEqual({ states: rows });
  });

  it("returns an empty list when there are no alert states", async () => {
    mockDb.securityAlertState.findMany.mockResolvedValue([]);
    const res = await listSecurityAlertStates();
    expect(res.states).toEqual([]);
  });
});
