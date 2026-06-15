import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// timesheets.ts imports `db` from @finanzas/db at module load and transitively
// pulls in ./employees.ts (also imports db). We mock `db` (vi.hoisted) covering
// every model method the service touches (employeeTimesheet CRUD + $qb upsert +
// groupBy) and we mock ./employees.ts so the summary path returns controlled
// employees. $setOptions keeps @finanzas/db + /slices from throwing at import.
const {
  noopDb,
  mockTimesheetFindUnique,
  mockTimesheetFindFirst,
  mockTimesheetFindMany,
  mockTimesheetCreate,
  mockTimesheetUpdate,
  mockTimesheetDelete,
  mockTimesheetGroupBy,
  mockQbExecuteTakeFirstOrThrow,
  qbBuilder,
  mockGetEmployeeById,
  mockListEmployees,
} = vi.hoisted(() => {
  const mockTimesheetFindUnique = vi.fn();
  const mockTimesheetFindFirst = vi.fn();
  const mockTimesheetFindMany = vi.fn();
  const mockTimesheetCreate = vi.fn();
  const mockTimesheetUpdate = vi.fn();
  const mockTimesheetDelete = vi.fn();
  const mockTimesheetGroupBy = vi.fn();
  const mockGetEmployeeById = vi.fn();
  const mockListEmployees = vi.fn();
  // Kysely-style fluent $qb: every chainable returns the same builder; the
  // terminal executeTakeFirstOrThrow resolves the row we control. We capture
  // the .values(...) / .onConflict callback args so tests can assert them.
  const mockQbExecuteTakeFirstOrThrow = vi.fn();
  const valuesArg = { current: undefined as unknown };
  const conflictSet = { current: undefined as unknown };
  const qbBuilder = {
    valuesArg,
    conflictSet,
    insertInto: (..._a: unknown[]) => qbBuilder,
    values: (v: unknown) => {
      valuesArg.current = v;
      return qbBuilder;
    },
    onConflict: (cb: (oc: unknown) => unknown) => {
      const oc = {
        columns: (..._c: unknown[]) => ({
          doUpdateSet: (s: unknown) => {
            conflictSet.current = s;
            return qbBuilder;
          },
        }),
      };
      cb(oc);
      return qbBuilder;
    },
    returningAll: () => qbBuilder,
    executeTakeFirstOrThrow: (...a: unknown[]) => mockQbExecuteTakeFirstOrThrow(...a),
  };
  const noopDb = {
    $setOptions: () => noopDb,
    $qb: qbBuilder,
    employeeTimesheet: {
      findUnique: (...a: unknown[]) => mockTimesheetFindUnique(...a),
      findFirst: (...a: unknown[]) => mockTimesheetFindFirst(...a),
      findMany: (...a: unknown[]) => mockTimesheetFindMany(...a),
      create: (...a: unknown[]) => mockTimesheetCreate(...a),
      update: (...a: unknown[]) => mockTimesheetUpdate(...a),
      delete: (...a: unknown[]) => mockTimesheetDelete(...a),
      groupBy: (...a: unknown[]) => mockTimesheetGroupBy(...a),
    },
  };
  return {
    noopDb,
    mockTimesheetFindUnique,
    mockTimesheetFindFirst,
    mockTimesheetFindMany,
    mockTimesheetCreate,
    mockTimesheetUpdate,
    mockTimesheetDelete,
    mockTimesheetGroupBy,
    mockQbExecuteTakeFirstOrThrow,
    qbBuilder,
    mockGetEmployeeById,
    mockListEmployees,
  };
});
vi.mock("@finanzas/db", () => ({ db: noopDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: noopDb }));
vi.mock("../employees.ts", () => ({
  getEmployeeById: (...a: unknown[]) => mockGetEmployeeById(...a),
  listEmployees: (...a: unknown[]) => mockListEmployees(...a),
}));

import { DomainError } from "../../lib/errors.ts";
import type { getEmployeeById } from "../employees.ts";
import type { UpsertTimesheetPayload } from "../timesheets.ts";
import {
  buildEmployeeSummary,
  buildMonthlySummary,
  calculateWorkedMinutes,
  computePayDate,
  dateOnlyEndUtc,
  dateOnlyStartUtc,
  dateToTimeString,
  deleteTimesheetEntry,
  durationToMinutes,
  ensureFixedSalaryRecord,
  formatDbDateOnly,
  getTimesheetEntryById,
  listTimesheetEntries,
  minutesToDuration,
  monthStartUtc,
  normalizeTimeString,
  normalizeTimesheetPayload,
  normalizeUpsertPayload,
  parseDateOnlyUtc,
  timeStringToDate,
  timeToMinutes,
  updateTimesheetEntry,
  upsertTimesheetEntry,
} from "../timesheets.ts";

beforeEach(() => {
  mockTimesheetFindUnique.mockReset();
  mockTimesheetFindFirst.mockReset();
  mockTimesheetFindMany.mockReset();
  mockTimesheetCreate.mockReset();
  mockTimesheetUpdate.mockReset();
  mockTimesheetDelete.mockReset();
  mockTimesheetGroupBy.mockReset();
  mockQbExecuteTakeFirstOrThrow.mockReset();
  mockGetEmployeeById.mockReset();
  mockListEmployees.mockReset();
  qbBuilder.valuesArg.current = undefined;
  qbBuilder.conflictSet.current = undefined;
});

// Assert a thrown DomainError with EXACT kind + message. Pins both so Stryker
// mutants that swap the kind or edit the literal message die.
function expectDomainErrorSync(fn: () => unknown, kind: DomainError["kind"], message: string) {
  let caught: unknown;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(DomainError);
  expect((caught as DomainError).kind).toBe(kind);
  expect((caught as DomainError).message).toBe(message);
}

async function expectDomainErrorAsync(
  promise: Promise<unknown>,
  kind: DomainError["kind"],
  message: string
) {
  await promise.then(
    () => {
      throw new Error("expected promise to reject");
    },
    (err: unknown) => {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).kind).toBe(kind);
      expect((err as DomainError).message).toBe(message);
    }
  );
}

// Build a minimal UpsertTimesheetPayload; only the fields the function under
// test reads matter, the rest satisfy the type.
function payload(overrides: Partial<UpsertTimesheetPayload>): UpsertTimesheetPayload {
  return {
    employee_id: 1,
    work_date: "2026-01-15",
    overtime_minutes: 0,
    ...overrides,
  };
}

describe("parseDateOnlyUtc", () => {
  it("parses a valid YYYY-MM-DD into a PlainDate", () => {
    const d = parseDateOnlyUtc("2026-03-09");
    expect(d?.toString()).toBe("2026-03-09");
    expect(d?.year).toBe(2026);
    expect(d?.month).toBe(3); // PlainDate months are 1-indexed
    expect(d?.day).toBe(9);
  });

  it("is null for a non-strict / wrong format", () => {
    expect(parseDateOnlyUtc("2026-3-9")).toBeNull();
    expect(parseDateOnlyUtc("03/09/2026")).toBeNull();
    expect(parseDateOnlyUtc("not-a-date")).toBeNull();
    expect(parseDateOnlyUtc("")).toBeNull();
  });

  it("rejects an out-of-range month via strict parsing", () => {
    expect(parseDateOnlyUtc("2026-13-01")).toBeNull();
  });
});

describe("dateOnlyStartUtc", () => {
  it("returns the UTC start-of-day instant", () => {
    const d = dateOnlyStartUtc("2026-03-09");
    expect(d.toISOString()).toBe("2026-03-09T00:00:00.000Z");
  });

  it("handles a leap day", () => {
    expect(dateOnlyStartUtc("2024-02-29").toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("throws on invalid format with a descriptive message", () => {
    expect(() => dateOnlyStartUtc("2026-3-9")).toThrow(/Invalid date format/);
    expect(() => dateOnlyStartUtc("bad")).toThrow(/Expected YYYY-MM-DD/);
  });
});

describe("dateOnlyEndUtc", () => {
  it("returns the UTC end-of-day instant (23:59:59.999)", () => {
    const d = dateOnlyEndUtc("2026-03-09");
    expect(d.toISOString()).toBe("2026-03-09T23:59:59.999Z");
  });

  it("differs from start-of-day by one millisecond short of a day", () => {
    const start = dateOnlyStartUtc("2026-03-09").getTime();
    const end = dateOnlyEndUtc("2026-03-09").getTime();
    expect(end - start).toBe(86_400_000 - 1);
  });

  it("throws on invalid format", () => {
    expect(() => dateOnlyEndUtc("nope")).toThrow(/Invalid date format/);
  });
});

describe("monthStartUtc", () => {
  it("returns the first-of-month PlainDate for YYYY-MM", () => {
    expect(monthStartUtc("2026-03").toString()).toBe("2026-03-01");
  });

  it("supports adding a month to derive the exclusive upper bound", () => {
    expect(monthStartUtc("2026-12").add({ months: 1 }).toString()).toBe("2027-01-01");
  });

  it("throws on a full date or invalid month", () => {
    expect(() => monthStartUtc("2026-03-01")).toThrow(/Invalid month format/);
    expect(() => monthStartUtc("2026-13")).toThrow(/Expected YYYY-MM/);
  });
});

describe("formatDbDateOnly", () => {
  it("formats a Date to YYYY-MM-DD in UTC", () => {
    expect(formatDbDateOnly(new Date("2026-03-09T23:30:00.000Z"))).toBe("2026-03-09");
  });

  it("formats an ISO string to YYYY-MM-DD in UTC", () => {
    expect(formatDbDateOnly("2026-07-04T00:00:00.000Z")).toBe("2026-07-04");
  });

  it("uses the UTC calendar day even near midnight", () => {
    expect(formatDbDateOnly(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01-01");
  });
});

describe("timeToMinutes", () => {
  it("converts HH:MM to minutes since midnight", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("01:00")).toBe(60);
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  it("converts HH:MM:SS (seconds ignored) to minutes", () => {
    expect(timeToMinutes("09:30:45")).toBe(570);
    expect(timeToMinutes("12:00:00")).toBe(720);
  });

  it("handles single-digit hours", () => {
    expect(timeToMinutes("9:05")).toBe(545);
  });

  it("throws on empty string", () => {
    expect(() => timeToMinutes("")).toThrow(/Time string is required/);
  });

  it("throws on malformed strings", () => {
    expect(() => timeToMinutes("9h30")).toThrow(/Invalid time format/);
    expect(() => timeToMinutes("12:")).toThrow(/Invalid time format/);
  });

  it("throws when hours/minutes are out of range", () => {
    expect(() => timeToMinutes("24:00")).toThrow(/Time out of range/);
    expect(() => timeToMinutes("12:60")).toThrow(/Time out of range/);
  });
});

describe("normalizeTimeString", () => {
  it("returns null for empty input", () => {
    expect(normalizeTimeString("")).toBeNull();
  });

  it("normalizes HH:MM to HH:MM:SS with zero seconds", () => {
    expect(normalizeTimeString("09:05")).toBe("09:05:00");
    expect(normalizeTimeString("9:5".replace("9:5", "09:05"))).toBe("09:05:00");
  });

  it("pads single-digit hours", () => {
    expect(normalizeTimeString("7:30")).toBe("07:30:00");
  });

  it("preserves seconds in HH:MM:SS", () => {
    expect(normalizeTimeString("23:59:59")).toBe("23:59:59");
    expect(normalizeTimeString("00:00:00")).toBe("00:00:00");
  });

  it("returns null for malformed time", () => {
    expect(normalizeTimeString("abc")).toBeNull();
    expect(normalizeTimeString("12h")).toBeNull();
  });

  it("returns null for out-of-range components", () => {
    expect(normalizeTimeString("24:00")).toBeNull();
    expect(normalizeTimeString("10:60")).toBeNull();
    expect(normalizeTimeString("10:10:60")).toBeNull();
  });

  it("converts an ISO timestamp to Santiago-local HH:MM:SS", () => {
    // 2026-01-15T12:40:00Z; Santiago in January is UTC-3 (summer / CLST) -> 09:40:00
    expect(normalizeTimeString("2026-01-15T12:40:00.000Z")).toBe("09:40:00");
  });

  it("converts an ISO timestamp in winter (UTC-3 standard) correctly", () => {
    // 2026-07-15T15:00:00Z; Santiago in July is UTC-4 (winter / CLT) -> 11:00:00
    expect(normalizeTimeString("2026-07-15T15:00:00.000Z")).toBe("11:00:00");
  });
});

describe("timeStringToDate", () => {
  it("anchors HH:MM as the UTC wall-clock time (no +3h/+4h shift)", () => {
    // @db.Time round-trips by UTC components: 09:00 must be stored as 09:00Z,
    // NOT 12:00Z. The reference day is preserved (UTC), time set from input.
    const ref = new Date("2026-01-15T12:00:00.000Z");
    const d = timeStringToDate("09:00", ref);
    expect(d.toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });

  it("builds a Date from HH:MM:SS preserving seconds", () => {
    const ref = new Date("2026-01-15T05:00:00.000Z");
    const d = timeStringToDate("09:30:15", ref);
    expect(d.toISOString()).toBe("2026-01-15T09:30:15.000Z");
  });

  it("is timezone-independent — winter/summer offsets do not shift the time", () => {
    const ref = new Date("2026-07-15T12:00:00.000Z");
    const d = timeStringToDate("08:00", ref);
    expect(d.toISOString()).toBe("2026-07-15T08:00:00.000Z");
  });

  it("anchors the reference day in UTC (a Santiago-evening ref keeps its UTC day)", () => {
    // 2026-05-04T00:00:00Z is how ZenStack returns a @db.Date workDate. The
    // stored time component must land on that same UTC day, not roll back.
    const ref = new Date("2026-05-04T00:00:00.000Z");
    const d = timeStringToDate("10:30", ref);
    expect(d.toISOString()).toBe("2026-05-04T10:30:00.000Z");
  });

  it("throws when no time string is provided", () => {
    expect(() => timeStringToDate(null)).toThrow(/Time string is required/);
    expect(() => timeStringToDate(undefined)).toThrow(/Time string is required/);
    expect(() => timeStringToDate("")).toThrow(/Time string is required/);
  });

  it("throws on out-of-range components", () => {
    expect(() => timeStringToDate("24:00")).toThrow(/Invalid time components/);
    expect(() => timeStringToDate("10:60")).toThrow(/Invalid time components/);
  });

  it("throws on an unparseable string", () => {
    expect(() => timeStringToDate("nonsense")).toThrow(/Unable to parse time string/);
  });
});

describe("dateToTimeString", () => {
  it("returns null for null input", () => {
    expect(dateToTimeString(null)).toBeNull();
  });

  it("extracts HH:MM from an HH:MM string", () => {
    expect(dateToTimeString("09:30")).toBe("09:30");
  });

  it("extracts HH:MM from an HH:MM:SS string (drops seconds)", () => {
    expect(dateToTimeString("23:59:59")).toBe("23:59");
  });

  it("pads single-digit hours from a string", () => {
    expect(dateToTimeString("7:05")).toBe("07:05");
  });

  it("formats a UTC-anchored @db.Time Date to HH:mm (no TZ shift)", () => {
    // ZenStack/Prisma returns @db.Time columns as Dates anchored at
    // 1970-01-01 in UTC. Must format in UTC so server TZ (America/Santiago)
    // doesn't shift the wall-clock time by -3h.
    const date = new Date("1970-01-01T08:15:00.000Z");
    expect(dateToTimeString(date)).toBe("08:15");
  });

  it("returns null for an unparseable string", () => {
    expect(dateToTimeString("not-a-time")).toBeNull();
  });
});

describe("normalizeUpsertPayload (regression: work_date must not roll back a day)", () => {
  // Bug 2026-06-05: under server TZ=America/Santiago, `dayjs(utcMidnight).format`
  // rolled the work_date back one day (2026-05-04 stored as 2026-05-03). The
  // vitest env pins TZ=America/Santiago so this test reproduces the prod TZ.
  it("preserves the work_date string round-trip", () => {
    const n = normalizeUpsertPayload(
      payload({ work_date: "2026-05-04", start_time: "10:30", end_time: "19:45" })
    );
    expect(n.workDateDb).toBe("2026-05-04");
  });

  it("keeps times as plain HH:MM:SS strings (no TZ shift on write)", () => {
    const n = normalizeUpsertPayload(
      payload({ work_date: "2026-05-04", start_time: "10:30", end_time: "19:45" })
    );
    expect(n.startTimeStr).toBe("10:30:00");
    expect(n.endTimeStr).toBe("19:45:00");
  });

  it("preserves work_date across a DST boundary (winter month)", () => {
    const n = normalizeUpsertPayload(payload({ work_date: "2026-07-15" }));
    expect(n.workDateDb).toBe("2026-07-15");
  });
});

describe("calculateWorkedMinutes", () => {
  it("returns the provided worked_minutes when positive", () => {
    expect(calculateWorkedMinutes(payload({ worked_minutes: 480 }))).toBe(480);
  });

  it("prefers provided worked_minutes even when start/end are present", () => {
    expect(
      calculateWorkedMinutes(
        payload({ worked_minutes: 100, start_time: "09:00", end_time: "18:00" })
      )
    ).toBe(100);
  });

  it("returns 0 when worked_minutes is 0 and start/end missing", () => {
    expect(calculateWorkedMinutes(payload({}))).toBe(0);
    expect(calculateWorkedMinutes(payload({ start_time: "09:00" }))).toBe(0);
    expect(calculateWorkedMinutes(payload({ end_time: "18:00" }))).toBe(0);
  });

  it("computes the difference for a normal same-day shift", () => {
    expect(calculateWorkedMinutes(payload({ start_time: "09:00", end_time: "17:30" }))).toBe(510);
  });

  it("handles a midnight-rollover overnight shift", () => {
    // 22:00 -> 06:00 = 8h = 480 min
    expect(calculateWorkedMinutes(payload({ start_time: "22:00", end_time: "06:00" }))).toBe(480);
  });

  it("treats equal start and end as zero minutes (not a full day)", () => {
    expect(calculateWorkedMinutes(payload({ start_time: "09:00", end_time: "09:00" }))).toBe(0);
  });

  it("computes a one-minute shift correctly", () => {
    expect(calculateWorkedMinutes(payload({ start_time: "09:00", end_time: "09:01" }))).toBe(1);
  });

  it("computes a full-day-minus-one-minute overnight shift", () => {
    // 09:01 start, 09:00 end next day -> 24*60 + (540 - 541) = 1439
    expect(calculateWorkedMinutes(payload({ start_time: "09:01", end_time: "09:00" }))).toBe(1439);
  });

  it("treats negative worked_minutes as not-provided and computes from times", () => {
    expect(
      calculateWorkedMinutes(
        payload({ worked_minutes: -5, start_time: "09:00", end_time: "10:00" })
      )
    ).toBe(60);
  });
});

// Sanity: ensure the time-dependent default (referenceDate = new Date()) of
// timeStringToDate is exercised with a pinned clock so a mutated default is
// caught.
describe("timeStringToDate default reference date (pinned clock)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-15T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("anchors to today's UTC date when no reference is given", () => {
    // System now: 2026-05-15T12:00:00Z. UTC day is 2026-05-15; 09:00 wall-clock
    // is anchored as 09:00Z on that day (no TZ offset applied).
    const d = timeStringToDate("09:00");
    expect(d.toISOString()).toBe("2026-05-15T09:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// DomainError branches — EXACT kind + message (Stryker mutant killers)
//
// Las pruebas de arriba usan `.toThrow(/regex/)`, que NO ata el `kind` ni el
// texto exacto del mensaje → un mutante que cambie el kind ("BAD_REQUEST" →
// "NOT_FOUND") o edite el literal sobrevive. Aquí afirmamos instanceof
// DomainError + `.kind` + `.message` literal por cada `throw` de timesheets.ts.
// ---------------------------------------------------------------------------

describe("timesheets DomainError branches (exact kind + message)", () => {
  describe("dateOnlyStartUtc / dateOnlyEndUtc — BAD_REQUEST invalid date", () => {
    it("dateOnlyStartUtc interpola el valor y el formato esperado", () => {
      expectDomainErrorSync(
        () => dateOnlyStartUtc("2026-3-9"),
        "BAD_REQUEST",
        "Invalid date format: 2026-3-9. Expected YYYY-MM-DD"
      );
    });

    it("dateOnlyEndUtc interpola el valor y el formato esperado", () => {
      expectDomainErrorSync(
        () => dateOnlyEndUtc("nope"),
        "BAD_REQUEST",
        "Invalid date format: nope. Expected YYYY-MM-DD"
      );
    });
  });

  describe("monthStartUtc — BAD_REQUEST invalid month", () => {
    it("rechaza una fecha completa con el mensaje exacto", () => {
      expectDomainErrorSync(
        () => monthStartUtc("2026-03-01"),
        "BAD_REQUEST",
        "Invalid month format: 2026-03-01. Expected YYYY-MM"
      );
    });

    it("rechaza un mes fuera de rango", () => {
      expectDomainErrorSync(
        () => monthStartUtc("2026-13"),
        "BAD_REQUEST",
        "Invalid month format: 2026-13. Expected YYYY-MM"
      );
    });
  });

  describe("timeToMinutes — BAD_REQUEST (4 ramas)", () => {
    it('string vacío → "Time string is required"', () => {
      expectDomainErrorSync(() => timeToMinutes(""), "BAD_REQUEST", "Time string is required");
    });

    it('formato malo → "Invalid time format: …"', () => {
      expectDomainErrorSync(
        () => timeToMinutes("9h30"),
        "BAD_REQUEST",
        "Invalid time format: 9h30. Expected HH:MM or HH:MM:SS"
      );
    });

    it('horas fuera de rango → "Time out of range: …"', () => {
      expectDomainErrorSync(
        () => timeToMinutes("24:00"),
        "BAD_REQUEST",
        "Time out of range: 24:00"
      );
    });

    it('minutos fuera de rango → "Time out of range: …"', () => {
      expectDomainErrorSync(
        () => timeToMinutes("12:60"),
        "BAD_REQUEST",
        "Time out of range: 12:60"
      );
    });
  });

  describe("timeStringToDate — BAD_REQUEST (3 ramas)", () => {
    it('null → "Time string is required for date conversion"', () => {
      expectDomainErrorSync(
        () => timeStringToDate(null),
        "BAD_REQUEST",
        "Time string is required for date conversion"
      );
    });

    it('componentes HH:MM fuera de rango → "Invalid time components in: …"', () => {
      expectDomainErrorSync(
        () => timeStringToDate("24:00"),
        "BAD_REQUEST",
        "Invalid time components in: 24:00"
      );
    });

    it('string inparseable → "Unable to parse time string: …"', () => {
      expectDomainErrorSync(
        () => timeStringToDate("nonsense"),
        "BAD_REQUEST",
        "Unable to parse time string: nonsense"
      );
    });
  });

  describe("getTimesheetEntryById — NOT_FOUND", () => {
    it('registro inexistente → NOT_FOUND "Registro no encontrado"', async () => {
      mockTimesheetFindUnique.mockResolvedValue(null);
      await expectDomainErrorAsync(
        getTimesheetEntryById(123),
        "NOT_FOUND",
        "Registro no encontrado"
      );
    });
  });
});

// ---------------------------------------------------------------------------
// BODY coverage — db-interacting + summary/reporting functions.
// Asserts REAL mapped values + EXACT db-call args to kill where:{}/data
// literal + arithmetic + boundary mutants.
// ---------------------------------------------------------------------------

// A raw EmployeeTimesheet row as ZenStack returns it. workDate is a @db.Date
// (UTC-anchored midnight Date); start/end are @db.Time (Date) or null.
function rawTimesheet(over: Record<string, unknown> = {}) {
  return {
    id: 10n,
    employeeId: 3,
    workDate: new Date("2026-05-04T00:00:00.000Z"),
    startTime: new Date("1970-01-01T09:00:00.000Z"),
    endTime: new Date("1970-01-01T18:00:00.000Z"),
    workedMinutes: 540,
    overtimeMinutes: 30,
    comment: "turno",
    ...over,
  };
}

// A controlled employee (shape consumed by buildEmployeeSummary). retentionRate
// 0.1 is a NON-default custom rate so getEffectiveRetentionRate returns it
// verbatim → deterministic math.
function makeEmployee(over: Record<string, unknown> = {}) {
  return {
    id: 3,
    position: "RECEPCIONISTA",
    status: "ACTIVE",
    salaryType: "HOURLY",
    hourlyRate: 6000,
    overtimeRate: 9000,
    retentionRate: 0.1,
    baseSalary: 0,
    person: { names: "Ana Perez", email: "ana@x.cl" },
    ...over,
  } as unknown as Awaited<ReturnType<typeof getEmployeeById>>;
}

describe("getTimesheetEntryById — success mapping", () => {
  it("maps a raw row into the snake_case TimesheetEntry", async () => {
    mockTimesheetFindUnique.mockResolvedValueOnce(rawTimesheet());
    const r = await getTimesheetEntryById(10);
    expect(r).toEqual({
      id: 10,
      employee_id: 3,
      work_date: "2026-05-04",
      start_time: "09:00",
      end_time: "18:00",
      worked_minutes: 540,
      overtime_minutes: 30,
      comment: "turno",
    });
    expect(mockTimesheetFindUnique).toHaveBeenCalledWith({ where: { id: 10n } });
  });

  it("maps null start/end and null comment to empty strings", async () => {
    mockTimesheetFindUnique.mockResolvedValueOnce(
      rawTimesheet({ startTime: null, endTime: null, comment: null })
    );
    const r = await getTimesheetEntryById(10);
    expect(r.start_time).toBe("");
    expect(r.end_time).toBe("");
    expect(r.comment).toBe("");
  });
});

describe("ensureFixedSalaryRecord", () => {
  it("no-ops when the employee is not FIXED", async () => {
    mockGetEmployeeById.mockResolvedValueOnce(makeEmployee({ salaryType: "HOURLY" }));
    await ensureFixedSalaryRecord(3, "2026-05");
    expect(mockTimesheetFindFirst).not.toHaveBeenCalled();
    expect(mockTimesheetCreate).not.toHaveBeenCalled();
  });

  it("no-ops when the employee is missing", async () => {
    mockGetEmployeeById.mockResolvedValueOnce(null);
    await ensureFixedSalaryRecord(3, "2026-05");
    expect(mockTimesheetCreate).not.toHaveBeenCalled();
  });

  it("no-ops when a record already exists for the month", async () => {
    mockGetEmployeeById.mockResolvedValueOnce(makeEmployee({ salaryType: "FIXED" }));
    mockTimesheetFindFirst.mockResolvedValueOnce({ id: 99n });
    await ensureFixedSalaryRecord(3, "2026-05");
    expect(mockTimesheetCreate).not.toHaveBeenCalled();
    // dedupe window is [monthStart, nextMonthStart)
    const where = (
      mockTimesheetFindFirst.mock.calls[0][0] as { where: { workDate: { gte: Date; lt: Date } } }
    ).where;
    expect(where.workDate.gte.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(where.workDate.lt.toISOString()).toBe("2026-06-01T00:00:00.000Z");
  });

  it("creates a synthetic FIXED-salary record when none exists", async () => {
    mockGetEmployeeById.mockResolvedValueOnce(makeEmployee({ salaryType: "FIXED" }));
    mockTimesheetFindFirst.mockResolvedValueOnce(null);
    mockTimesheetCreate.mockResolvedValueOnce(undefined);
    await ensureFixedSalaryRecord(3, "2026-05");
    expect(mockTimesheetCreate).toHaveBeenCalledTimes(1);
    const data = (mockTimesheetCreate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect(data.employeeId).toBe(3);
    expect((data.workDate as Date).toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(data.startTime).toBeNull();
    expect(data.endTime).toBeNull();
    expect(data.workedMinutes).toBe(0);
    expect(data.overtimeMinutes).toBe(0);
    expect(data.comment).toBe("Sueldo fijo mensual");
  });
});

describe("listTimesheetEntries", () => {
  it("queries the date window + employee filter, ordered asc, and maps rows", async () => {
    mockGetEmployeeById.mockResolvedValueOnce(makeEmployee({ salaryType: "HOURLY" }));
    mockTimesheetFindMany.mockResolvedValueOnce([rawTimesheet()]);
    const r = await listTimesheetEntries({ employee_id: 3, from: "2026-05-01", to: "2026-05-31" });
    expect(r).toHaveLength(1);
    expect(r[0].work_date).toBe("2026-05-04");
    const arg = mockTimesheetFindMany.mock.calls[0][0] as {
      where: { employeeId: number; workDate: { gte: Date; lte: Date } };
      orderBy: { workDate: string };
    };
    expect(arg.where.employeeId).toBe(3);
    expect(arg.where.workDate.gte.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(arg.where.workDate.lte.toISOString()).toBe("2026-05-31T23:59:59.999Z");
    expect(arg.orderBy).toEqual({ workDate: "asc" });
  });

  it("omits the employeeId filter when no employee_id given", async () => {
    mockTimesheetFindMany.mockResolvedValueOnce([]);
    await listTimesheetEntries({ from: "2026-05-01", to: "2026-05-31" });
    const arg = mockTimesheetFindMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect("employeeId" in arg.where).toBe(false);
    // no employee_id → ensureFixedSalaryRecord is NOT invoked
    expect(mockGetEmployeeById).not.toHaveBeenCalled();
  });

  it("swallows an ensureFixedSalaryRecord failure and still lists", async () => {
    mockGetEmployeeById.mockRejectedValueOnce(new Error("boom"));
    mockTimesheetFindMany.mockResolvedValueOnce([]);
    const r = await listTimesheetEntries({ employee_id: 3, from: "2026-05-01", to: "2026-05-31" });
    expect(r).toEqual([]);
    expect(mockTimesheetFindMany).toHaveBeenCalledTimes(1);
  });

  it("extracts YYYY-MM from `from` for the fixed-salary check", async () => {
    mockGetEmployeeById.mockResolvedValueOnce(makeEmployee({ salaryType: "FIXED" }));
    mockTimesheetFindFirst.mockResolvedValueOnce({ id: 1n });
    mockTimesheetFindMany.mockResolvedValueOnce([]);
    await listTimesheetEntries({ employee_id: 3, from: "2026-07-22", to: "2026-07-31" });
    expect(mockGetEmployeeById).toHaveBeenCalledWith(3);
    const where = (
      mockTimesheetFindFirst.mock.calls[0][0] as { where: { workDate: { gte: Date } } }
    ).where;
    expect(where.workDate.gte.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});

describe("upsertTimesheetEntry", () => {
  it("inserts normalized values + onConflict update set, then maps the row", async () => {
    mockQbExecuteTakeFirstOrThrow.mockResolvedValueOnce({
      id: 55n,
      employeeId: 3,
      workDate: new Date("2026-05-04T00:00:00.000Z"),
      startTime: new Date("1970-01-01T10:30:00.000Z"),
      endTime: new Date("1970-01-01T19:45:00.000Z"),
      workedMinutes: 555,
      overtimeMinutes: 15,
      comment: "x",
    });

    const r = await upsertTimesheetEntry({
      employee_id: 3,
      work_date: "2026-05-04",
      start_time: "10:30",
      end_time: "19:45",
      overtime_minutes: 15,
      comment: "x",
    });

    expect(r).toEqual({
      id: 55,
      employee_id: 3,
      work_date: "2026-05-04",
      start_time: "10:30",
      end_time: "19:45",
      worked_minutes: 555,
      overtime_minutes: 15,
      comment: "x",
    });

    // Insert payload: normalized work_date string + HH:MM:SS times + computed minutes
    const values = qbBuilder.valuesArg.current as Record<string, unknown>;
    expect(values.employeeId).toBe(3);
    expect(values.workDate).toBe("2026-05-04");
    expect(values.startTime).toBe("10:30:00");
    expect(values.endTime).toBe("19:45:00");
    expect(values.workedMinutes).toBe(555); // 19:45 - 10:30 = 9h15 = 555
    expect(values.overtimeMinutes).toBe(15);
    expect(values.comment).toBe("x");

    // onConflict doUpdateSet mirrors the same normalized fields (no employeeId/workDate)
    const set = qbBuilder.conflictSet.current as Record<string, unknown>;
    expect(set.startTime).toBe("10:30:00");
    expect(set.endTime).toBe("19:45:00");
    expect(set.workedMinutes).toBe(555);
    expect(set.overtimeMinutes).toBe(15);
    expect(set.comment).toBe("x");
  });

  it("nulls times + comment when absent and keeps provided worked_minutes", async () => {
    mockQbExecuteTakeFirstOrThrow.mockResolvedValueOnce({
      id: 1n,
      employeeId: 3,
      workDate: new Date("2026-05-04T00:00:00.000Z"),
      startTime: null,
      endTime: null,
      workedMinutes: 200,
      overtimeMinutes: 0,
      comment: null,
    });
    const r = await upsertTimesheetEntry({
      employee_id: 3,
      work_date: "2026-05-04",
      worked_minutes: 200,
      overtime_minutes: 0,
    });
    expect(r.start_time).toBe("");
    expect(r.end_time).toBe("");
    expect(r.comment).toBe("");
    const values = qbBuilder.valuesArg.current as Record<string, unknown>;
    expect(values.startTime).toBeNull();
    expect(values.endTime).toBeNull();
    expect(values.workedMinutes).toBe(200);
    expect(values.comment).toBeNull();
  });
});

describe("updateTimesheetEntry", () => {
  it("throws NOT_FOUND when the row does not exist", async () => {
    mockTimesheetFindUnique.mockResolvedValueOnce(null);
    await expectDomainErrorAsync(
      updateTimesheetEntry(10, { worked_minutes: 5 }),
      "NOT_FOUND",
      "Registro no encontrado"
    );
  });

  it("re-reads (no update) when the patch is empty", async () => {
    // first findUnique inside buildTimesheetUpdateData (existing), second inside
    // getTimesheetEntryById fallback
    mockTimesheetFindUnique
      .mockResolvedValueOnce(rawTimesheet())
      .mockResolvedValueOnce(rawTimesheet());
    const r = await updateTimesheetEntry(10, {});
    expect(mockTimesheetUpdate).not.toHaveBeenCalled();
    expect(r.id).toBe(10);
  });

  it("builds the update data from each provided field and maps the result", async () => {
    mockTimesheetFindUnique.mockResolvedValueOnce(rawTimesheet());
    mockTimesheetUpdate.mockResolvedValueOnce(
      rawTimesheet({ workedMinutes: 100, overtimeMinutes: 20, comment: "new" })
    );
    const r = await updateTimesheetEntry(10, {
      start_time: "08:00",
      end_time: "12:00",
      worked_minutes: 100,
      overtime_minutes: 20,
      comment: "new",
    });
    expect(r.worked_minutes).toBe(100);
    expect(r.overtime_minutes).toBe(20);
    expect(r.comment).toBe("new");

    const call = mockTimesheetUpdate.mock.calls[0][0] as {
      where: { id: bigint };
      data: {
        startTime: Date;
        endTime: Date;
        workedMinutes: number;
        overtimeMinutes: number;
        comment: string;
      };
    };
    expect(call.where).toEqual({ id: 10n });
    // referenceDate is the existing workDate (2026-05-04), times anchored UTC
    expect(call.data.startTime.toISOString()).toBe("2026-05-04T08:00:00.000Z");
    expect(call.data.endTime.toISOString()).toBe("2026-05-04T12:00:00.000Z");
    expect(call.data.workedMinutes).toBe(100);
    expect(call.data.overtimeMinutes).toBe(20);
    expect(call.data.comment).toBe("new");
  });

  it("treats null worked/overtime as not-provided but null comment as provided", async () => {
    mockTimesheetFindUnique.mockResolvedValueOnce(rawTimesheet());
    mockTimesheetUpdate.mockResolvedValueOnce(rawTimesheet({ comment: null }));
    await updateTimesheetEntry(10, {
      worked_minutes: null as unknown as number,
      overtime_minutes: null as unknown as number,
      comment: null,
    });
    const data = (mockTimesheetUpdate.mock.calls[0][0] as { data: Record<string, unknown> }).data;
    expect("workedMinutes" in data).toBe(false);
    expect("overtimeMinutes" in data).toBe(false);
    expect("comment" in data).toBe(true);
    expect(data.comment).toBeNull();
  });
});

describe("deleteTimesheetEntry", () => {
  it("deletes by BigInt id", async () => {
    mockTimesheetDelete.mockResolvedValueOnce(undefined);
    await deleteTimesheetEntry(10);
    expect(mockTimesheetDelete).toHaveBeenCalledWith({ where: { id: 10n } });
  });
});

describe("minutesToDuration", () => {
  it("formats minutes as zero-padded HH:MM", () => {
    expect(minutesToDuration(0)).toBe("00:00");
    expect(minutesToDuration(5)).toBe("00:05");
    expect(minutesToDuration(60)).toBe("01:00");
    expect(minutesToDuration(125)).toBe("02:05");
    expect(minutesToDuration(1439)).toBe("23:59");
  });

  it("handles durations over 24h without wrapping the hour", () => {
    expect(minutesToDuration(1500)).toBe("25:00");
  });
});

describe("durationToMinutes", () => {
  it("parses HH:MM into minutes", () => {
    expect(durationToMinutes("00:00")).toBe(0);
    expect(durationToMinutes("01:00")).toBe(60);
    expect(durationToMinutes("02:05")).toBe(125);
  });

  it("treats missing components as 0", () => {
    expect(durationToMinutes("")).toBe(0);
    expect(durationToMinutes("3")).toBe(180);
    expect(durationToMinutes(":30")).toBe(30);
  });

  it("round-trips with minutesToDuration", () => {
    expect(durationToMinutes(minutesToDuration(555))).toBe(555);
  });
});

describe("normalizeTimesheetPayload", () => {
  it("passes through provided worked_minutes and defaults the rest", () => {
    expect(
      normalizeTimesheetPayload({ employee_id: 3, work_date: "2026-05-04", worked_minutes: 480 })
    ).toEqual({
      employee_id: 3,
      work_date: "2026-05-04",
      start_time: null,
      end_time: null,
      worked_minutes: 480,
      overtime_minutes: 0,
      comment: null,
    });
  });

  it("computes worked_minutes from start/end when absent", () => {
    const r = normalizeTimesheetPayload({
      employee_id: 3,
      work_date: "2026-05-04",
      start_time: "09:00",
      end_time: "17:30",
      overtime_minutes: 30,
      comment: "c",
    });
    expect(r.worked_minutes).toBe(510);
    expect(r.overtime_minutes).toBe(30);
    expect(r.start_time).toBe("09:00");
    expect(r.end_time).toBe("17:30");
    expect(r.comment).toBe("c");
  });

  it("clamps a negative computed difference to 0 (end before start)", () => {
    const r = normalizeTimesheetPayload({
      employee_id: 3,
      work_date: "2026-05-04",
      start_time: "18:00",
      end_time: "09:00",
    });
    expect(r.worked_minutes).toBe(0);
  });

  it("does not recompute when worked_minutes already positive", () => {
    const r = normalizeTimesheetPayload({
      employee_id: 3,
      work_date: "2026-05-04",
      worked_minutes: 999,
      start_time: "09:00",
      end_time: "17:00",
    });
    expect(r.worked_minutes).toBe(999);
  });
});

describe("computePayDate", () => {
  it("TENS → day 5 (calendar) of the next month", () => {
    expect(computePayDate("TENS", "2026-05-10")).toBe("2026-06-05");
  });

  it('"Técnico en Enfermería" (accents normalized) → day 5 calendar', () => {
    expect(computePayDate("Técnico en Enfermería", "2026-05-10")).toBe("2026-06-05");
  });

  it("Enfermero Universitario → 5th BUSINESS day of next month", () => {
    // June 2026: 1=Mon..5=Fri → 5th business day = 2026-06-05
    expect(computePayDate("Enfermero Universitario", "2026-05-10")).toBe("2026-06-05");
  });

  it('generic "ENFER" role → 5th business day of next month', () => {
    expect(computePayDate("Enfermera Clínica", "2026-05-10")).toBe("2026-06-05");
  });

  it("other roles → day 5 calendar of next month", () => {
    expect(computePayDate("RECEPCIONISTA", "2026-05-10")).toBe("2026-06-05");
  });

  it("rolls the year over from December", () => {
    expect(computePayDate("RECEPCIONISTA", "2026-12-10")).toBe("2027-01-05");
  });

  it("uses business-day calc that skips a weekend (March 2026)", () => {
    // March 2026: 1=Sun. Business days: 2(Mon),3,4,5,6(Fri) → 5th = 2026-03-06
    expect(computePayDate("Enfermero Universitario", "2026-02-15")).toBe("2026-03-06");
  });
});

describe("buildEmployeeSummary", () => {
  it("returns the zeroed Unknown summary when employee is null", () => {
    const r = buildEmployeeSummary(null, {
      workedMinutes: 100,
      overtimeMinutes: 10,
      periodStart: "2026-05-01",
    });
    expect(r.employeeId).toBe(0);
    expect(r.fullName).toBe("Unknown");
    expect(r.net).toBe(0);
    expect(r.payDate).toBe("");
    expect(r.hoursFormatted).toBe("00:00");
  });

  it("computes HOURLY pay: base + overtime, retention, net", () => {
    // hourlyRate 6000, overtimeRate 9000, custom retention 0.1
    // base = (600/60)*6000 = 60000 ; ot = (120/60)*9000 = 18000
    // subtotal 78000 ; retention 7800 ; net 70200
    const r = buildEmployeeSummary(makeEmployee(), {
      workedMinutes: 600,
      overtimeMinutes: 120,
      periodStart: "2026-05-01",
    });
    expect(r.hourlyRate).toBe(6000);
    expect(r.overtimeRate).toBe(9000);
    expect(r.retentionRate).toBe(0.1);
    expect(r.subtotal).toBe(78000);
    expect(r.retention).toBe(7800);
    expect(r.net).toBe(70200);
    expect(r.workedMinutes).toBe(600);
    expect(r.overtimeMinutes).toBe(120);
    expect(r.hoursFormatted).toBe("10:00");
    expect(r.overtimeFormatted).toBe("02:00");
    expect(r.fullName).toBe("Ana Perez");
    expect(r.email).toBe("ana@x.cl");
    expect(r.payDate).toBe("2026-06-05");
  });

  it("derives overtimeRate as hourlyRate*1.5 when overtimeRate is 0", () => {
    const r = buildEmployeeSummary(makeEmployee({ overtimeRate: 0 }), {
      workedMinutes: 0,
      overtimeMinutes: 60,
      periodStart: "2026-05-01",
    });
    expect(r.overtimeRate).toBe(9000); // 6000 * 1.5
    expect(r.subtotal).toBe(9000); // (60/60)*9000
  });

  it("FIXED salary: subtotal = baseSalary, zeroes hours, 'Sueldo fijo'", () => {
    const r = buildEmployeeSummary(makeEmployee({ salaryType: "FIXED", baseSalary: 800000 }), {
      workedMinutes: 999,
      overtimeMinutes: 999,
      periodStart: "2026-05-01",
    });
    expect(r.subtotal).toBe(800000);
    expect(r.retention).toBe(80000); // 0.1 custom
    expect(r.net).toBe(720000);
    expect(r.workedMinutes).toBe(0);
    expect(r.overtimeMinutes).toBe(0);
    expect(r.hourlyRate).toBe(0);
    expect(r.hoursFormatted).toBe("Sueldo fijo");
    expect(r.overtimeFormatted).toBe("-");
  });

  it("falls back email to null when person.email is absent", () => {
    const r = buildEmployeeSummary(makeEmployee({ person: { names: "Bob", email: null } }), {
      workedMinutes: 0,
      overtimeMinutes: 0,
      periodStart: "2026-05-01",
    });
    expect(r.email).toBeNull();
  });
});

describe("buildMonthlySummary", () => {
  it("merges grouped timesheet sums with active employees lacking timesheets", async () => {
    const withTs = makeEmployee({ id: 3, person: { names: "Bravo", email: null } });
    const noTs = makeEmployee({ id: 4, person: { names: "Alfa", email: null } });
    mockListEmployees.mockResolvedValueOnce([withTs, noTs]);
    mockTimesheetGroupBy.mockResolvedValueOnce([
      { employeeId: 3, _sum: { workedMinutes: 600, overtimeMinutes: 0 } },
    ]);

    const r = await buildMonthlySummary("2026-05-01", "2026-05-31");

    // groupBy scoped to the date window, no employee filter
    const gb = mockTimesheetGroupBy.mock.calls[0][0] as {
      by: string[];
      where: { workDate: { gte: Date; lte: Date }; employeeId?: number };
    };
    expect(gb.by).toEqual(["employeeId"]);
    expect(gb.where.workDate.gte.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(gb.where.workDate.lte.toISOString()).toBe("2026-05-31T23:59:59.999Z");
    expect("employeeId" in gb.where).toBe(false);

    // both employees present, sorted by name (Alfa before Bravo)
    expect(r.employees.map((e) => e.fullName)).toEqual(["Alfa", "Bravo"]);
    const bravo = r.employees.find((e) => e.fullName === "Bravo");
    expect(bravo?.workedMinutes).toBe(600);
    expect(bravo?.subtotal).toBe(60000); // (600/60)*6000

    // totals aggregate both: Bravo subtotal 60000 (+retention 6000, net 54000),
    // Alfa subtotal 0
    expect(r.totals.subtotal).toBe(60000);
    expect(r.totals.retention).toBe(6000);
    expect(r.totals.net).toBe(54000);
    expect(r.totals.hours).toBe("10:00");
    expect(r.totals.overtime).toBe("00:00");
  });

  it("skips groupBy rows for employees not in the map", async () => {
    mockListEmployees.mockResolvedValueOnce([makeEmployee({ id: 3 })]);
    mockTimesheetGroupBy.mockResolvedValueOnce([
      { employeeId: 999, _sum: { workedMinutes: 600, overtimeMinutes: 0 } },
    ]);
    const r = await buildMonthlySummary("2026-05-01", "2026-05-31");
    // employee 3 has no timesheet → included with 0s; phantom 999 dropped
    expect(r.employees).toHaveLength(1);
    expect(r.employees[0].employeeId).toBe(3);
    expect(r.employees[0].workedMinutes).toBe(0);
  });

  it("excludes non-ACTIVE employees without timesheets", async () => {
    mockListEmployees.mockResolvedValueOnce([
      makeEmployee({ id: 3, status: "ACTIVE", person: { names: "A", email: null } }),
      makeEmployee({ id: 4, status: "INACTIVE", person: { names: "B", email: null } }),
    ]);
    mockTimesheetGroupBy.mockResolvedValueOnce([]);
    const r = await buildMonthlySummary("2026-05-01", "2026-05-31");
    expect(r.employees.map((e) => e.employeeId)).toEqual([3]);
  });

  it("scopes groupBy to a single employeeId and filters the active fill-in", async () => {
    mockListEmployees.mockResolvedValueOnce([
      makeEmployee({ id: 3, person: { names: "A", email: null } }),
      makeEmployee({ id: 4, person: { names: "B", email: null } }),
    ]);
    mockTimesheetGroupBy.mockResolvedValueOnce([
      { employeeId: 3, _sum: { workedMinutes: 60, overtimeMinutes: 0 } },
    ]);
    const r = await buildMonthlySummary("2026-05-01", "2026-05-31", 3);
    const gb = mockTimesheetGroupBy.mock.calls[0][0] as { where: { employeeId?: number } };
    expect(gb.where.employeeId).toBe(3);
    // only employee 3 returned; employee 4 filtered out of the active fill-in
    expect(r.employees.map((e) => e.employeeId)).toEqual([3]);
  });

  it("includes a filtered employee with 0s when no timesheet data at all", async () => {
    mockListEmployees.mockResolvedValueOnce([
      makeEmployee({ id: 3, status: "INACTIVE", person: { names: "A", email: null } }),
    ]);
    mockTimesheetGroupBy.mockResolvedValueOnce([]);
    // employeeId 3 requested; it's INACTIVE so the active loop skips it, but the
    // final fallback re-adds it with 0s.
    const r = await buildMonthlySummary("2026-05-01", "2026-05-31", 3);
    expect(r.employees).toHaveLength(1);
    expect(r.employees[0].employeeId).toBe(3);
    expect(r.employees[0].workedMinutes).toBe(0);
  });
});
