import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AttendanceMarkData,
  type AttendanceMarkType,
  computeWorkedMinutes,
  ipMatchesCidr,
  ipToNumber,
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
