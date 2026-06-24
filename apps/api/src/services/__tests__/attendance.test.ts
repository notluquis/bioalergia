import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// attendance.ts toca db.attendanceMark / db.employee / db.officeNetwork y delega
// el sync de horas a upsertTimesheetEntry (./timesheets.ts). Mockeamos @finanzas/db
// (vi.hoisted) y ./timesheets.ts para cubrir: CRUD de marcas y office-networks,
// el sync a timesheet, el status diario (semana/mes) y los filtros de listMarks.
// Las helpers puras (ipToNumber/ipMatchesCidr/computeWorkedMinutes) no tocan db.

const {
  mockDb,
  mockMarkCreate,
  mockMarkFindMany,
  mockMarkDelete,
  mockEmployeeFindFirst,
  mockOfficeFindMany,
  mockOfficeCreate,
  mockOfficeUpdate,
  mockOfficeDelete,
  mockUpsertTimesheetEntry,
} = vi.hoisted(() => {
  const mockMarkCreate = vi.fn();
  const mockMarkFindMany = vi.fn();
  const mockMarkDelete = vi.fn();
  const mockEmployeeFindFirst = vi.fn();
  const mockOfficeFindMany = vi.fn();
  const mockOfficeCreate = vi.fn();
  const mockOfficeUpdate = vi.fn();
  const mockOfficeDelete = vi.fn();
  const mockUpsertTimesheetEntry = vi.fn();
  const mockDb = {
    attendanceMark: {
      create: (...a: unknown[]) => mockMarkCreate(...a),
      findMany: (...a: unknown[]) => mockMarkFindMany(...a),
      delete: (...a: unknown[]) => mockMarkDelete(...a),
    },
    employee: {
      findFirst: (...a: unknown[]) => mockEmployeeFindFirst(...a),
    },
    officeNetwork: {
      findMany: (...a: unknown[]) => mockOfficeFindMany(...a),
      create: (...a: unknown[]) => mockOfficeCreate(...a),
      update: (...a: unknown[]) => mockOfficeUpdate(...a),
      delete: (...a: unknown[]) => mockOfficeDelete(...a),
    },
  };
  return {
    mockDb,
    mockMarkCreate,
    mockMarkFindMany,
    mockMarkDelete,
    mockEmployeeFindFirst,
    mockOfficeFindMany,
    mockOfficeCreate,
    mockOfficeUpdate,
    mockOfficeDelete,
    mockUpsertTimesheetEntry,
  };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("../timesheets.ts", () => ({
  upsertTimesheetEntry: (...a: unknown[]) => mockUpsertTimesheetEntry(...a),
}));

import {
  type AttendanceMarkData,
  type AttendanceMarkType,
  checkIsOfficeNetwork,
  computeWorkedMinutes,
  createAdminMark,
  createMark,
  createOfficeNetwork,
  deleteMark,
  deleteOfficeNetwork,
  findEmployeeByUserId,
  getTodayStatus,
  ipMatchesCidr,
  ipToNumber,
  listMarks,
  listOfficeNetworks,
  syncMarkToTimesheet,
  updateOfficeNetwork,
} from "../attendance.ts";

// ─── Test fixtures ──────────────────────────────────────────────────────────

/** Build a minimal AttendanceMarkData; only `type` and `markedAt` drive the pure logic. */
function mark(type: AttendanceMarkType, markedAt: Date, id = 1): AttendanceMarkData {
  return {
    id,
    employeeId: 1,
    markedAt,
    type,
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    ipAddress: null,
    isOfficeNetwork: false,
    userAgent: null,
    connectionType: null,
    downlinkMbps: null,
    isMobile: null,
    clientTimezone: null,
    deviceRam: null,
    cpuCores: null,
    screenResolution: null,
    devicePixelRatio: null,
    notes: null,
    createdByUserId: null,
  };
}

const ci = (markedAt: Date, id?: number) => mark("CLOCK_IN", markedAt, id);
const co = (markedAt: Date, id?: number) => mark("CLOCK_OUT", markedAt, id);

/** Build a raw DB row (id: bigint, plus the extra include fields when needed). */
function rawMark(over: Record<string, unknown> = {}) {
  return {
    id: 1n,
    employeeId: 1,
    markedAt: new Date("2026-05-15T12:00:00.000Z"),
    type: "CLOCK_IN",
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    ipAddress: null,
    isOfficeNetwork: false,
    userAgent: null,
    connectionType: null,
    downlinkMbps: null,
    isMobile: null,
    clientTimezone: null,
    deviceRam: null,
    cpuCores: null,
    screenResolution: null,
    devicePixelRatio: null,
    notes: null,
    createdByUserId: null,
    ...over,
  };
}

beforeEach(() => {
  mockMarkCreate.mockReset();
  mockMarkFindMany.mockReset();
  mockMarkDelete.mockReset();
  mockEmployeeFindFirst.mockReset();
  mockOfficeFindMany.mockReset();
  mockOfficeCreate.mockReset();
  mockOfficeUpdate.mockReset();
  mockOfficeDelete.mockReset();
  mockUpsertTimesheetEntry.mockReset();
});

// ─── ipToNumber (security-relevant: office-network gate) ──────────────────────

describe("ipToNumber", () => {
  it("converts 0.0.0.0 to 0", () => {
    expect(ipToNumber("0.0.0.0")).toBe(0);
  });

  it("converts 255.255.255.255 to 4294967295 (unsigned, no overflow)", () => {
    expect(ipToNumber("255.255.255.255")).toBe(4_294_967_295);
  });

  it("converts 192.168.1.1 to its exact 32-bit value", () => {
    // 192<<24 | 168<<16 | 1<<8 | 1 = 3232235777
    expect(ipToNumber("192.168.1.1")).toBe(3_232_235_777);
  });

  it("converts 10.0.0.1 to its exact value", () => {
    expect(ipToNumber("10.0.0.1")).toBe(167_772_161);
  });

  it("converts 128.0.0.0 unsigned (high bit set, would be negative if signed)", () => {
    expect(ipToNumber("128.0.0.0")).toBe(2_147_483_648);
  });

  it("returns null for fewer than 4 octets", () => {
    expect(ipToNumber("1.2.3")).toBeNull();
  });

  it("returns null for more than 4 octets", () => {
    expect(ipToNumber("1.2.3.4.5")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(ipToNumber("")).toBeNull();
  });

  it("returns null for non-numeric octet", () => {
    expect(ipToNumber("1.2.3.abc")).toBeNull();
  });

  it("returns null when an octet exceeds 255", () => {
    expect(ipToNumber("256.1.1.1")).toBeNull();
    expect(ipToNumber("1.1.1.256")).toBeNull();
  });

  it("returns null when an octet is negative", () => {
    expect(ipToNumber("-1.1.1.1")).toBeNull();
  });

  it("accepts boundary octet values 0 and 255", () => {
    expect(ipToNumber("0.0.0.255")).toBe(255);
    expect(ipToNumber("255.0.0.0")).toBe(4_278_190_080);
  });
});

// ─── ipMatchesCidr (security-relevant: office-network gate) ───────────────────

describe("ipMatchesCidr", () => {
  it("exact match when CIDR has no slash", () => {
    expect(ipMatchesCidr("192.168.1.1", "192.168.1.1")).toBe(true);
  });

  it("exact mismatch when CIDR has no slash", () => {
    expect(ipMatchesCidr("192.168.1.2", "192.168.1.1")).toBe(false);
  });

  it("/32 matches only the single host", () => {
    expect(ipMatchesCidr("192.168.1.1", "192.168.1.1/32")).toBe(true);
    expect(ipMatchesCidr("192.168.1.2", "192.168.1.1/32")).toBe(false);
  });

  it("/24 matches any host in the subnet", () => {
    expect(ipMatchesCidr("192.168.1.0", "192.168.1.0/24")).toBe(true); // network address
    expect(ipMatchesCidr("192.168.1.1", "192.168.1.0/24")).toBe(true); // first usable
    expect(ipMatchesCidr("192.168.1.254", "192.168.1.0/24")).toBe(true); // last usable
    expect(ipMatchesCidr("192.168.1.255", "192.168.1.0/24")).toBe(true); // broadcast
  });

  it("/24 rejects a host just outside the subnet", () => {
    expect(ipMatchesCidr("192.168.2.0", "192.168.1.0/24")).toBe(false); // next subnet
    expect(ipMatchesCidr("192.168.0.255", "192.168.1.0/24")).toBe(false); // previous subnet
  });

  it("/24 ignores host bits in the network portion of the CIDR", () => {
    // CIDR network has host bits set; mask zeroes them, so .50 still matches the /24
    expect(ipMatchesCidr("192.168.1.99", "192.168.1.50/24")).toBe(true);
  });

  it("/16 boundary: edges of the 192.168.0.0/16 range", () => {
    expect(ipMatchesCidr("192.168.0.0", "192.168.0.0/16")).toBe(true); // first
    expect(ipMatchesCidr("192.168.255.255", "192.168.0.0/16")).toBe(true); // last
    expect(ipMatchesCidr("192.169.0.0", "192.168.0.0/16")).toBe(false); // just past last
    expect(ipMatchesCidr("192.167.255.255", "192.168.0.0/16")).toBe(false); // just before first
  });

  it("/8 boundary: edges of the 10.0.0.0/8 range", () => {
    expect(ipMatchesCidr("10.0.0.0", "10.0.0.0/8")).toBe(true);
    expect(ipMatchesCidr("10.255.255.255", "10.0.0.0/8")).toBe(true);
    expect(ipMatchesCidr("11.0.0.0", "10.0.0.0/8")).toBe(false);
    expect(ipMatchesCidr("9.255.255.255", "10.0.0.0/8")).toBe(false);
  });

  it("/0 matches every address (mask is zero)", () => {
    expect(ipMatchesCidr("0.0.0.0", "0.0.0.0/0")).toBe(true);
    expect(ipMatchesCidr("255.255.255.255", "8.8.8.8/0")).toBe(true);
    expect(ipMatchesCidr("123.45.67.89", "0.0.0.0/0")).toBe(true);
  });

  it("/31 matches the two-host pair only", () => {
    expect(ipMatchesCidr("192.168.1.0", "192.168.1.0/31")).toBe(true);
    expect(ipMatchesCidr("192.168.1.1", "192.168.1.0/31")).toBe(true);
    expect(ipMatchesCidr("192.168.1.2", "192.168.1.0/31")).toBe(false);
  });

  it("returns false for a prefix above 32", () => {
    expect(ipMatchesCidr("192.168.1.1", "192.168.1.1/33")).toBe(false);
  });

  it("returns false for a negative prefix", () => {
    expect(ipMatchesCidr("192.168.1.1", "192.168.1.1/-1")).toBe(false);
  });

  it("returns false for a non-numeric prefix", () => {
    expect(ipMatchesCidr("192.168.1.1", "192.168.1.1/abc")).toBe(false);
  });

  it("returns false when the queried IP is malformed", () => {
    expect(ipMatchesCidr("not.an.ip.addr", "192.168.1.0/24")).toBe(false);
    expect(ipMatchesCidr("999.0.0.0", "192.168.1.0/24")).toBe(false);
  });

  it("returns false when the CIDR network part is malformed", () => {
    expect(ipMatchesCidr("192.168.1.1", "bad.network/24")).toBe(false);
  });

  it("returns false when the network part is empty", () => {
    expect(ipMatchesCidr("192.168.1.1", "/24")).toBe(false);
  });
});

// ─── computeWorkedMinutes ─────────────────────────────────────────────────────

describe("computeWorkedMinutes", () => {
  it("returns null for empty marks", () => {
    expect(computeWorkedMinutes([])).toBeNull();
  });

  it("returns null for a single CLOCK_IN (no out)", () => {
    expect(computeWorkedMinutes([ci(new Date(2026, 4, 15, 9, 0, 0))])).toBeNull();
  });

  it("returns null for a single CLOCK_OUT (no in)", () => {
    expect(computeWorkedMinutes([co(new Date(2026, 4, 15, 17, 0, 0))])).toBeNull();
  });

  it("returns null when all marks are CLOCK_IN", () => {
    expect(
      computeWorkedMinutes([
        ci(new Date(2026, 4, 15, 9, 0, 0)),
        ci(new Date(2026, 4, 15, 10, 0, 0)),
      ])
    ).toBeNull();
  });

  it("computes exact minutes for one in/out pair (8h = 480)", () => {
    expect(
      computeWorkedMinutes([
        ci(new Date(2026, 4, 15, 9, 0, 0)),
        co(new Date(2026, 4, 15, 17, 0, 0)),
      ])
    ).toBe(480);
  });

  it("uses earliest CLOCK_IN and latest CLOCK_OUT across multiple pairs", () => {
    // earliest in 08:00, latest out 18:30 → 10h30m = 630 min (lunch gap ignored)
    expect(
      computeWorkedMinutes([
        ci(new Date(2026, 4, 15, 8, 0, 0)),
        co(new Date(2026, 4, 15, 13, 0, 0)),
        ci(new Date(2026, 4, 15, 14, 0, 0)),
        co(new Date(2026, 4, 15, 18, 30, 0)),
      ])
    ).toBe(630);
  });

  it("picks earliest IN even when marks are unsorted", () => {
    expect(
      computeWorkedMinutes([
        co(new Date(2026, 4, 15, 18, 30, 0)),
        ci(new Date(2026, 4, 15, 14, 0, 0)),
        ci(new Date(2026, 4, 15, 8, 0, 0)),
        co(new Date(2026, 4, 15, 13, 0, 0)),
      ])
    ).toBe(630);
  });

  it("returns null when the latest OUT is before the earliest IN", () => {
    // out at 07:00 precedes in at 09:00
    expect(
      computeWorkedMinutes([ci(new Date(2026, 4, 15, 9, 0, 0)), co(new Date(2026, 4, 15, 7, 0, 0))])
    ).toBeNull();
  });

  it("returns null when OUT exactly equals IN (boundary, strictly greater required)", () => {
    const t = new Date(2026, 4, 15, 9, 0, 0);
    expect(computeWorkedMinutes([ci(t), co(new Date(t.getTime()))])).toBeNull();
  });

  it("returns 1 for a 90-second span (floors to whole minutes)", () => {
    expect(
      computeWorkedMinutes([
        ci(new Date(2026, 4, 15, 9, 0, 0)),
        co(new Date(2026, 4, 15, 9, 1, 30)),
      ])
    ).toBe(1);
  });

  it("handles an overnight pair spanning two calendar days", () => {
    // 22:00 → next day 06:00 = 8h = 480 min
    expect(
      computeWorkedMinutes([
        ci(new Date(2026, 4, 15, 22, 0, 0)),
        co(new Date(2026, 4, 16, 6, 0, 0)),
      ])
    ).toBe(480);
  });

  it("ignores an unpaired trailing CLOCK_IN, spanning only to the latest OUT", () => {
    // in 09:00, out 17:00, then a stray in 18:00 → still 480 (latest OUT is 17:00)
    expect(
      computeWorkedMinutes([
        ci(new Date(2026, 4, 15, 9, 0, 0)),
        co(new Date(2026, 4, 15, 17, 0, 0)),
        ci(new Date(2026, 4, 15, 18, 0, 0)),
      ])
    ).toBe(480);
  });
});

// Clock is pinned even though the pure helpers under test do not read "now".
// This guards against accidental Date.now() coupling surviving a mutation.
describe("clock independence", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("computeWorkedMinutes does not depend on the system clock", () => {
    const result = computeWorkedMinutes([
      ci(new Date(2026, 0, 1, 9, 0, 0)),
      co(new Date(2026, 0, 1, 17, 0, 0)),
    ]);
    expect(result).toBe(480);
  });
});

// ─── findEmployeeByUserId ─────────────────────────────────────────────────────

describe("findEmployeeByUserId", () => {
  it("queries the employee via the Person→User chain with the exact select", async () => {
    mockEmployeeFindFirst.mockResolvedValueOnce({ id: 9, personId: 3, status: "ACTIVE" });
    const r = await findEmployeeByUserId(42);
    expect(r).toEqual({ id: 9, personId: 3, status: "ACTIVE" });
    expect(mockEmployeeFindFirst).toHaveBeenCalledWith({
      where: { person: { user: { id: 42 } } },
      select: { id: true, personId: true, status: true },
    });
  });

  it("returns null when no employee is linked", async () => {
    mockEmployeeFindFirst.mockResolvedValueOnce(null);
    expect(await findEmployeeByUserId(1)).toBeNull();
  });
});

// ─── checkIsOfficeNetwork ─────────────────────────────────────────────────────

describe("checkIsOfficeNetwork", () => {
  it("returns false immediately for an empty IP (no DB query)", async () => {
    expect(await checkIsOfficeNetwork("")).toBe(false);
    expect(mockOfficeFindMany).not.toHaveBeenCalled();
  });

  it("queries only active networks selecting cidr", async () => {
    mockOfficeFindMany.mockResolvedValueOnce([]);
    await checkIsOfficeNetwork("10.0.0.1");
    expect(mockOfficeFindMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: { cidr: true },
    });
  });

  it("returns true when the IP matches one active CIDR", async () => {
    mockOfficeFindMany.mockResolvedValueOnce([{ cidr: "10.0.0.0/8" }, { cidr: "192.168.1.0/24" }]);
    expect(await checkIsOfficeNetwork("192.168.1.50")).toBe(true);
  });

  it("returns false when no CIDR matches", async () => {
    mockOfficeFindMany.mockResolvedValueOnce([{ cidr: "10.0.0.0/8" }]);
    expect(await checkIsOfficeNetwork("172.16.0.1")).toBe(false);
  });

  it("returns false when there are no active networks", async () => {
    mockOfficeFindMany.mockResolvedValueOnce([]);
    expect(await checkIsOfficeNetwork("10.0.0.1")).toBe(false);
  });
});

// ─── createMark ───────────────────────────────────────────────────────────────

describe("createMark", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T13:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves office network, persists nulls for absent fields, maps the row", async () => {
    mockOfficeFindMany.mockResolvedValueOnce([{ cidr: "10.0.0.0/8" }]);
    mockMarkCreate.mockResolvedValueOnce(rawMark({ id: 5n }));
    mockMarkFindMany.mockResolvedValueOnce([]); // sync: not enough marks → false

    const { mark: m, timesheetSynced } = await createMark(
      { employeeId: 7, type: "CLOCK_IN" },
      { ip: "10.1.2.3", userAgent: "UA" }
    );

    expect(m.id).toBe(5); // bigint → number
    expect(timesheetSynced).toBe(false);

    const arg = mockMarkCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.employeeId).toBe(7);
    expect(arg.data.type).toBe("CLOCK_IN");
    expect(arg.data.markedAt).toEqual(new Date("2026-05-15T13:00:00.000Z"));
    expect(arg.data.isOfficeNetwork).toBe(true); // 10.1.2.3 ∈ 10.0.0.0/8
    expect(arg.data.ipAddress).toBe("10.1.2.3");
    expect(arg.data.userAgent).toBe("UA");
    expect(arg.data.latitude).toBeNull();
    expect(arg.data.longitude).toBeNull();
    expect(arg.data.notes).toBeNull();
    expect(arg.data.createdByUserId).toBeNull();
  });

  it("defaults ip/userAgent to null when meta is null and isOfficeNetwork to false", async () => {
    // empty-IP short-circuit → checkIsOfficeNetwork false without querying
    mockMarkCreate.mockResolvedValueOnce(rawMark());
    mockMarkFindMany.mockResolvedValueOnce([]);

    await createMark({ employeeId: 1, type: "CLOCK_OUT" }, { ip: null, userAgent: null });

    const arg = mockMarkCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.ipAddress).toBeNull();
    expect(arg.data.userAgent).toBeNull();
    expect(arg.data.isOfficeNetwork).toBe(false);
    expect(mockOfficeFindMany).not.toHaveBeenCalled();
  });

  it("passes optional payload fields through verbatim", async () => {
    mockOfficeFindMany.mockResolvedValueOnce([]);
    mockMarkCreate.mockResolvedValueOnce(rawMark());
    mockMarkFindMany.mockResolvedValueOnce([]);

    await createMark(
      {
        employeeId: 1,
        type: "CLOCK_IN",
        latitude: -33.4,
        longitude: -70.6,
        accuracyMeters: 12,
        connectionType: "4g",
        downlinkMbps: 5,
        isMobile: true,
        clientTimezone: "America/Santiago",
        deviceRam: 8,
        cpuCores: 4,
        screenResolution: "1080x1920",
        devicePixelRatio: 2,
        createdByUserId: 99,
        notes: "hola",
      },
      { ip: "1.1.1.1", userAgent: "x" }
    );

    const arg = mockMarkCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.latitude).toBe(-33.4);
    expect(arg.data.longitude).toBe(-70.6);
    expect(arg.data.accuracyMeters).toBe(12);
    expect(arg.data.connectionType).toBe("4g");
    expect(arg.data.downlinkMbps).toBe(5);
    expect(arg.data.isMobile).toBe(true);
    expect(arg.data.clientTimezone).toBe("America/Santiago");
    expect(arg.data.deviceRam).toBe(8);
    expect(arg.data.cpuCores).toBe(4);
    expect(arg.data.screenResolution).toBe("1080x1920");
    expect(arg.data.devicePixelRatio).toBe(2);
    expect(arg.data.createdByUserId).toBe(99);
    expect(arg.data.notes).toBe("hola");
  });

  it("reports timesheetSynced=true when the day has a valid IN/OUT pair", async () => {
    mockOfficeFindMany.mockResolvedValueOnce([]);
    mockMarkCreate.mockResolvedValueOnce(rawMark());
    // sync re-queries the day's marks → complete pair → upsert + true
    mockMarkFindMany.mockResolvedValueOnce([
      rawMark({ type: "CLOCK_IN", markedAt: new Date("2026-05-15T12:00:00.000Z") }),
      rawMark({ type: "CLOCK_OUT", markedAt: new Date("2026-05-15T20:00:00.000Z") }),
    ]);
    mockUpsertTimesheetEntry.mockResolvedValueOnce({});

    const { timesheetSynced } = await createMark(
      { employeeId: 1, type: "CLOCK_OUT" },
      { ip: "1.1.1.1", userAgent: "x" }
    );
    expect(timesheetSynced).toBe(true);
    expect(mockUpsertTimesheetEntry).toHaveBeenCalledTimes(1);
  });
});

// ─── createAdminMark ──────────────────────────────────────────────────────────

describe("createAdminMark", () => {
  it("persists at the given past time with all geo/device fields nulled + admin id", async () => {
    const past = new Date("2026-05-10T14:30:00.000Z");
    mockMarkCreate.mockResolvedValueOnce(rawMark({ markedAt: past }));
    mockMarkFindMany.mockResolvedValueOnce([]);

    const { mark: m, timesheetSynced } = await createAdminMark(
      3,
      "CLOCK_OUT",
      past,
      55,
      "corrección"
    );

    expect(m.markedAt).toEqual(past); // mapped from the persisted row
    expect(timesheetSynced).toBe(false);
    const arg = mockMarkCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.employeeId).toBe(3);
    expect(arg.data.type).toBe("CLOCK_OUT");
    expect(arg.data.markedAt).toEqual(past);
    expect(arg.data.createdByUserId).toBe(55);
    expect(arg.data.notes).toBe("corrección");
    expect(arg.data.isOfficeNetwork).toBe(false);
    expect(arg.data.ipAddress).toBeNull();
    expect(arg.data.latitude).toBeNull();
    // admin marks never resolve office networks
    expect(mockOfficeFindMany).not.toHaveBeenCalled();
  });

  it("defaults notes to null when omitted", async () => {
    mockMarkCreate.mockResolvedValueOnce(rawMark());
    mockMarkFindMany.mockResolvedValueOnce([]);
    await createAdminMark(1, "CLOCK_IN", new Date("2026-05-10T08:00:00.000Z"), 2);
    const arg = mockMarkCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.notes).toBeNull();
  });
});

// ─── syncMarkToTimesheet ──────────────────────────────────────────────────────

describe("syncMarkToTimesheet", () => {
  // markedAt at midday UTC → 09:00 Chile (UTC-4) stays the same calendar day.
  const ref = new Date("2026-05-15T13:00:00.000Z");

  it("returns false when there is no CLOCK_IN", async () => {
    mockMarkFindMany.mockResolvedValueOnce([
      rawMark({ type: "CLOCK_OUT", markedAt: new Date("2026-05-15T20:00:00.000Z") }),
    ]);
    expect(await syncMarkToTimesheet(1, ref)).toBe(false);
    expect(mockUpsertTimesheetEntry).not.toHaveBeenCalled();
  });

  it("returns false when there is no CLOCK_OUT", async () => {
    mockMarkFindMany.mockResolvedValueOnce([
      rawMark({ type: "CLOCK_IN", markedAt: new Date("2026-05-15T12:00:00.000Z") }),
    ]);
    expect(await syncMarkToTimesheet(1, ref)).toBe(false);
    expect(mockUpsertTimesheetEntry).not.toHaveBeenCalled();
  });

  it("returns false when lastOut <= firstIn", async () => {
    mockMarkFindMany.mockResolvedValueOnce([
      rawMark({ type: "CLOCK_IN", markedAt: new Date("2026-05-15T18:00:00.000Z") }),
      rawMark({ type: "CLOCK_OUT", markedAt: new Date("2026-05-15T17:00:00.000Z") }),
    ]);
    expect(await syncMarkToTimesheet(1, ref)).toBe(false);
    expect(mockUpsertTimesheetEntry).not.toHaveBeenCalled();
  });

  it("upserts worked minutes from earliest IN to latest OUT and returns true", async () => {
    const firstIn = new Date("2026-05-15T12:00:00.000Z");
    const lastOut = new Date("2026-05-15T20:00:00.000Z"); // 8h later
    mockMarkFindMany.mockResolvedValueOnce([
      rawMark({ type: "CLOCK_IN", markedAt: firstIn }),
      rawMark({ type: "CLOCK_OUT", markedAt: new Date("2026-05-15T16:00:00.000Z") }),
      rawMark({ type: "CLOCK_OUT", markedAt: lastOut }),
    ]);
    mockUpsertTimesheetEntry.mockResolvedValueOnce({});

    expect(await syncMarkToTimesheet(13, ref)).toBe(true);

    const payload = mockUpsertTimesheetEntry.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.employee_id).toBe(13);
    expect(payload.worked_minutes).toBe(480);
    expect(payload.start_time).toBe(firstIn.toISOString());
    expect(payload.end_time).toBe(lastOut.toISOString());
    expect(payload.overtime_minutes).toBe(0);
    expect(payload.comment).toBe("Generado automáticamente desde marcaje");

    // queries the employee's marks within the Chile-day bounds, ascending
    const q = mockMarkFindMany.mock.calls[0][0] as {
      where: { employeeId: number; markedAt: { gte: Date; lte: Date } };
      orderBy: { markedAt: string };
    };
    expect(q.where.employeeId).toBe(13);
    expect(q.where.markedAt.gte).toBeInstanceOf(Date);
    expect(q.where.markedAt.lte).toBeInstanceOf(Date);
    expect(q.orderBy).toEqual({ markedAt: "asc" });
  });
});

// ─── getTodayStatus ───────────────────────────────────────────────────────────

describe("getTodayStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fri 2026-05-15 13:00 UTC = 09:00 Chile (UTC-4)
    vi.setSystemTime(new Date("2026-05-15T13:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports NO_MARKS_TODAY with empty week/month when no marks exist", async () => {
    mockMarkFindMany.mockResolvedValueOnce([]);
    const r = await getTodayStatus(1);
    expect(r.currentStatus).toBe("NO_MARKS_TODAY");
    expect(r.lastMark).toBeNull();
    expect(r.todayMarks).toEqual([]);
    expect(r.clockedInAt).toBeNull();
    expect(r.hasIncompleteYesterday).toBe(false);
    expect(r.monthStats).toEqual({ daysWorked: 0, totalMinutes: 0 });
    // week summary runs Mon..today (Fri) = 5 entries
    expect(r.weekSummary).toHaveLength(5);
    expect(r.weekSummary[r.weekSummary.length - 1].status).toBe("today");
    expect(r.weekSummary[r.weekSummary.length - 1].date).toBe("2026-05-15");
  });

  it("reports CLOCKED_IN with clockedInAt set when last mark today is a CLOCK_IN", async () => {
    const inAt = new Date("2026-05-15T12:30:00.000Z");
    mockMarkFindMany.mockResolvedValueOnce([rawMark({ type: "CLOCK_IN", markedAt: inAt })]);
    const r = await getTodayStatus(1);
    expect(r.currentStatus).toBe("CLOCKED_IN");
    expect(r.clockedInAt).toEqual(inAt);
    expect(r.lastMark?.type).toBe("CLOCK_IN");
  });

  it("reports CLOCKED_OUT (clockedInAt null) when last mark today is a CLOCK_OUT", async () => {
    mockMarkFindMany.mockResolvedValueOnce([
      rawMark({ type: "CLOCK_IN", markedAt: new Date("2026-05-15T12:00:00.000Z") }),
      rawMark({ type: "CLOCK_OUT", markedAt: new Date("2026-05-15T12:45:00.000Z") }),
    ]);
    const r = await getTodayStatus(1);
    expect(r.currentStatus).toBe("CLOCKED_OUT");
    expect(r.clockedInAt).toBeNull();
  });

  it("flags hasIncompleteYesterday when yesterday has IN but no OUT", async () => {
    mockMarkFindMany.mockResolvedValueOnce([
      // yesterday Thu 2026-05-14 12:00 UTC = 08:00 Chile, IN only
      rawMark({ type: "CLOCK_IN", markedAt: new Date("2026-05-14T12:00:00.000Z") }),
    ]);
    const r = await getTodayStatus(1);
    expect(r.hasIncompleteYesterday).toBe(true);
  });

  it("does not flag yesterday incomplete when it has both IN and OUT", async () => {
    mockMarkFindMany.mockResolvedValueOnce([
      rawMark({ type: "CLOCK_IN", markedAt: new Date("2026-05-14T12:00:00.000Z") }),
      rawMark({ type: "CLOCK_OUT", markedAt: new Date("2026-05-14T20:00:00.000Z") }),
    ]);
    const r = await getTodayStatus(1);
    expect(r.hasIncompleteYesterday).toBe(false);
  });

  it("counts a completed earlier day into monthStats but excludes today", async () => {
    mockMarkFindMany.mockResolvedValueOnce([
      // completed Mon 2026-05-11: 8h
      rawMark({ type: "CLOCK_IN", markedAt: new Date("2026-05-11T12:00:00.000Z") }),
      rawMark({ type: "CLOCK_OUT", markedAt: new Date("2026-05-11T20:00:00.000Z") }),
      // today IN only (in progress) → not counted in monthStats
      rawMark({ type: "CLOCK_IN", markedAt: new Date("2026-05-15T12:00:00.000Z") }),
    ]);
    const r = await getTodayStatus(1);
    expect(r.monthStats.daysWorked).toBe(1);
    expect(r.monthStats.totalMinutes).toBe(480);
  });

  it("classifies week days: worked / incomplete / absent / today", async () => {
    mockMarkFindMany.mockResolvedValueOnce([
      // Mon 2026-05-11 worked
      rawMark({ type: "CLOCK_IN", markedAt: new Date("2026-05-11T12:00:00.000Z") }),
      rawMark({ type: "CLOCK_OUT", markedAt: new Date("2026-05-11T20:00:00.000Z") }),
      // Tue 2026-05-12 incomplete (IN only)
      rawMark({ type: "CLOCK_IN", markedAt: new Date("2026-05-12T12:00:00.000Z") }),
      // Wed/Thu absent (no marks)
    ]);
    const r = await getTodayStatus(1);
    const byDate = Object.fromEntries(r.weekSummary.map((d) => [d.date, d.status]));
    expect(byDate["2026-05-11"]).toBe("worked");
    expect(byDate["2026-05-12"]).toBe("incomplete");
    expect(byDate["2026-05-13"]).toBe("absent");
    expect(byDate["2026-05-15"]).toBe("today");
  });

  it("computes today workedMinutes from first CLOCK_IN to now when IN-only", async () => {
    // today IN at 12:00 UTC; now is 13:00 UTC → 60 min elapsed
    mockMarkFindMany.mockResolvedValueOnce([
      rawMark({ type: "CLOCK_IN", markedAt: new Date("2026-05-15T12:00:00.000Z") }),
    ]);
    const r = await getTodayStatus(1);
    const todayEntry = r.weekSummary.find((d) => d.date === "2026-05-15");
    expect(todayEntry?.status).toBe("today");
    expect(todayEntry?.workedMinutes).toBe(60);
  });

  it("computes today workedMinutes via computeWorkedMinutes when IN and OUT both present", async () => {
    mockMarkFindMany.mockResolvedValueOnce([
      rawMark({ type: "CLOCK_IN", markedAt: new Date("2026-05-15T12:00:00.000Z") }),
      rawMark({ type: "CLOCK_OUT", markedAt: new Date("2026-05-15T12:30:00.000Z") }),
    ]);
    const r = await getTodayStatus(1);
    const todayEntry = r.weekSummary.find((d) => d.date === "2026-05-15");
    expect(todayEntry?.workedMinutes).toBe(30);
  });

  it("queries marks for the employee ordered ascending", async () => {
    mockMarkFindMany.mockResolvedValueOnce([]);
    await getTodayStatus(77);
    const q = mockMarkFindMany.mock.calls[0][0] as {
      where: { employeeId: number };
      orderBy: { markedAt: string };
    };
    expect(q.where.employeeId).toBe(77);
    expect(q.orderBy).toEqual({ markedAt: "asc" });
  });
});

// ─── listMarks ────────────────────────────────────────────────────────────────

function rawListMark(over: Record<string, unknown> = {}) {
  return rawMark({
    employee: { person: { names: "Juan", fatherName: "Pérez", rut: "11.111.111-1" } },
    ...over,
  });
}

describe("listMarks", () => {
  it("builds an empty where + descending order when no filters given", async () => {
    mockMarkFindMany.mockResolvedValueOnce([]);
    const r = await listMarks({});
    expect(r).toEqual({
      marks: [],
      summary: { totalMarks: 0, incompleteDays: 0, totalWorkedMinutes: 0 },
    });
    const arg = mockMarkFindMany.mock.calls[0][0] as { where: unknown; orderBy: unknown };
    expect(arg.where).toEqual({});
    expect(arg.orderBy).toEqual({ markedAt: "desc" });
  });

  it("scopes where by employeeId and date range when provided", async () => {
    mockMarkFindMany.mockResolvedValueOnce([]);
    await listMarks({ employeeId: 4, from: "2026-05-01", to: "2026-05-31" });
    const arg = mockMarkFindMany.mock.calls[0][0] as {
      where: { employeeId: number; markedAt: { gte: Date; lte: Date } };
    };
    expect(arg.where.employeeId).toBe(4);
    expect(arg.where.markedAt.gte).toBeInstanceOf(Date);
    expect(arg.where.markedAt.lte).toBeInstanceOf(Date);
  });

  it("includes only gte when only `from` is given", async () => {
    mockMarkFindMany.mockResolvedValueOnce([]);
    await listMarks({ from: "2026-05-01" });
    const arg = mockMarkFindMany.mock.calls[0][0] as {
      where: { markedAt: { gte?: Date; lte?: Date } };
    };
    expect(arg.where.markedAt.gte).toBeInstanceOf(Date);
    expect(arg.where.markedAt.lte).toBeUndefined();
  });

  it("derives employeeName + rut and totals one complete day (480 min)", async () => {
    mockMarkFindMany.mockResolvedValueOnce([
      rawListMark({ type: "CLOCK_OUT", markedAt: new Date("2026-05-15T20:00:00.000Z") }),
      rawListMark({ type: "CLOCK_IN", markedAt: new Date("2026-05-15T12:00:00.000Z") }),
    ]);
    const r = await listMarks({});
    expect(r.marks[0].employeeName).toBe("Juan Pérez");
    expect(r.marks[0].employeeRut).toBe("11.111.111-1");
    expect(r.marks[0].isDayIncomplete).toBe(false);
    expect(r.summary.totalMarks).toBe(2);
    expect(r.summary.incompleteDays).toBe(0);
    expect(r.summary.totalWorkedMinutes).toBe(480);
  });

  it("marks a day incomplete when only a CLOCK_IN exists and counts it", async () => {
    mockMarkFindMany.mockResolvedValueOnce([
      rawListMark({ type: "CLOCK_IN", markedAt: new Date("2026-05-15T12:00:00.000Z") }),
    ]);
    const r = await listMarks({});
    expect(r.marks[0].isDayIncomplete).toBe(true);
    expect(r.summary.incompleteDays).toBe(1);
    expect(r.summary.totalWorkedMinutes).toBe(0);
  });

  it("falls back employeeRut to undefined when person.rut is null", async () => {
    mockMarkFindMany.mockResolvedValueOnce([
      rawListMark({
        employee: { person: { names: "Ana", fatherName: null, rut: null } },
      }),
    ]);
    const r = await listMarks({});
    expect(r.marks[0].employeeName).toBe("Ana"); // fatherName null filtered out
    expect(r.marks[0].employeeRut).toBeUndefined();
  });

  it("completionStatus=complete keeps only complete-day marks", async () => {
    mockMarkFindMany.mockResolvedValueOnce([
      // complete day (emp 1)
      rawListMark({
        employeeId: 1,
        type: "CLOCK_IN",
        markedAt: new Date("2026-05-15T12:00:00.000Z"),
      }),
      rawListMark({
        employeeId: 1,
        type: "CLOCK_OUT",
        markedAt: new Date("2026-05-15T20:00:00.000Z"),
      }),
      // incomplete day (emp 2, IN only)
      rawListMark({
        employeeId: 2,
        type: "CLOCK_IN",
        markedAt: new Date("2026-05-15T12:00:00.000Z"),
      }),
    ]);
    const r = await listMarks({ completionStatus: "complete" });
    expect(r.marks).toHaveLength(2);
    expect(r.marks.every((m) => !m.isDayIncomplete)).toBe(true);
  });

  it("completionStatus=incomplete keeps only incomplete-day marks", async () => {
    mockMarkFindMany.mockResolvedValueOnce([
      rawListMark({
        employeeId: 1,
        type: "CLOCK_IN",
        markedAt: new Date("2026-05-15T12:00:00.000Z"),
      }),
      rawListMark({
        employeeId: 1,
        type: "CLOCK_OUT",
        markedAt: new Date("2026-05-15T20:00:00.000Z"),
      }),
      rawListMark({
        employeeId: 2,
        type: "CLOCK_IN",
        markedAt: new Date("2026-05-15T12:00:00.000Z"),
      }),
    ]);
    const r = await listMarks({ completionStatus: "incomplete" });
    expect(r.marks).toHaveLength(1);
    expect(r.marks[0].employeeId).toBe(2);
    expect(r.marks[0].isDayIncomplete).toBe(true);
  });
});

// ─── deleteMark ─────────────────────────────────────────────────────────────

describe("deleteMark", () => {
  it("deletes by bigint id", async () => {
    mockMarkDelete.mockResolvedValueOnce(undefined);
    await deleteMark(42);
    expect(mockMarkDelete).toHaveBeenCalledWith({ where: { id: 42n } });
  });
});

// ─── Office Networks CRUD ─────────────────────────────────────────────────────

describe("office networks CRUD", () => {
  it("listOfficeNetworks orders by id asc", async () => {
    mockOfficeFindMany.mockResolvedValueOnce([{ id: 1 }]);
    const r = await listOfficeNetworks();
    expect(r).toEqual([{ id: 1 }]);
    expect(mockOfficeFindMany).toHaveBeenCalledWith({ orderBy: { id: "asc" } });
  });

  it("createOfficeNetwork creates active with the given name/cidr", async () => {
    mockOfficeCreate.mockResolvedValueOnce({ id: 1 });
    await createOfficeNetwork("Clínica", "192.168.1.0/24");
    expect(mockOfficeCreate).toHaveBeenCalledWith({
      data: { name: "Clínica", cidr: "192.168.1.0/24", isActive: true },
    });
  });

  it("updateOfficeNetwork targets by id with the partial data", async () => {
    mockOfficeUpdate.mockResolvedValueOnce({ id: 7 });
    await updateOfficeNetwork(7, { name: "Nueva", isActive: false });
    expect(mockOfficeUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { name: "Nueva", isActive: false },
    });
  });

  it("deleteOfficeNetwork deletes by id", async () => {
    mockOfficeDelete.mockResolvedValueOnce(undefined);
    await deleteOfficeNetwork(3);
    expect(mockOfficeDelete).toHaveBeenCalledWith({ where: { id: 3 } });
  });
});
