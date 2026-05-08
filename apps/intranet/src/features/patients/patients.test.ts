import { describe, expect, it } from "vitest";
import { normalizeDecimalValues } from "./api";
import { normalizeBirthDate } from "./components/CreatePatientModal";
import { PatientListSchema } from "./schemas";

// Realistic patient shape as SuperJSON deserializes it (dates already as Date objects)
function makePatient(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-05-05T04:50:11.33Z");
  return {
    id: 1,
    personId: 1,
    birthDate: null,
    bloodType: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    person: {
      id: 1,
      names: "Paciente sin nombre",
      fatherName: null,
      motherName: null,
      rut: null,
      email: null,
      phone: null,
      address: null,
      personType: "NATURAL",
      createdAt: now,
      updatedAt: now,
    },
    ...overrides,
  };
}

describe("normalizeDecimalValues", () => {
  it("passes Date objects through unchanged", () => {
    const d = new Date("2026-05-05T04:50:11.33Z");
    expect(normalizeDecimalValues(d)).toBe(d);
  });

  it("passes Date objects nested in objects through unchanged", () => {
    const d = new Date("2026-05-05T04:50:11.33Z");
    const result = normalizeDecimalValues({ createdAt: d });
    expect((result as Record<string, unknown>).createdAt).toBe(d);
  });

  it("passes Date objects nested in arrays through unchanged", () => {
    const d = new Date("2026-05-05T04:50:11.33Z");
    const result = normalizeDecimalValues([{ createdAt: d }]) as Array<Record<string, unknown>>;
    const first = result[0];
    expect(first).toBeDefined();
    expect(first?.createdAt).toBe(d);
  });
});

describe("normalizeBirthDate", () => {
  it("returns undefined for empty string", () => {
    expect(normalizeBirthDate("")).toBeUndefined();
  });

  it("returns undefined for whitespace-only string", () => {
    expect(normalizeBirthDate("   ")).toBeUndefined();
  });

  it("passes through ISO date string", () => {
    expect(normalizeBirthDate("2000-10-17")).toBe("2000-10-17");
  });

  it("trims ISO datetime to date prefix", () => {
    expect(normalizeBirthDate("2000-10-17T00:00:00")).toBe("2000-10-17");
    expect(normalizeBirthDate("2000-10-17T00:00:00[America/Santiago]")).toBe("2000-10-17");
  });

  it("returns undefined for non-string CalendarDate-like object", () => {
    // Defensive: if a CalendarDate ever leaks into form state, JSON.stringify
    // would serialize it as { calendar, era, year, month, day }. We must not
    // forward that to a server schema that expects z.string().optional().
    const calendarDateLike = {
      calendar: { identifier: "gregory" },
      era: "AD",
      year: 2000,
      month: 10,
      day: 17,
    };
    expect(normalizeBirthDate(calendarDateLike)).toBeUndefined();
  });

  it("returns undefined for null and undefined", () => {
    expect(normalizeBirthDate(null)).toBeUndefined();
    expect(normalizeBirthDate(undefined)).toBeUndefined();
  });

  it("returns undefined for malformed string", () => {
    expect(normalizeBirthDate("17/10/2000")).toBeUndefined();
    expect(normalizeBirthDate("not a date")).toBeUndefined();
  });
});

describe("PatientListSchema", () => {
  it("parses patient with Date objects (SuperJSON output shape)", () => {
    const patient = makePatient();
    const result = PatientListSchema.parse(normalizeDecimalValues([patient]));
    expect(result).toHaveLength(1);
    const first = result[0];
    expect(first).toBeDefined();
    expect(first?.createdAt).toBeInstanceOf(Date);
    expect(first?.person.createdAt).toBeInstanceOf(Date);
  });

  it("parses patient with null rut", () => {
    const patient = makePatient({ person: { ...makePatient().person, rut: null } });
    const result = PatientListSchema.parse(normalizeDecimalValues([patient]));
    const first = result[0];
    expect(first).toBeDefined();
    expect(first?.person.rut).toBeNull();
  });

  it("parses patient with 2dp timestamp string (pre-SuperJSON shape)", () => {
    const patient = makePatient({
      createdAt: "2026-05-05T04:50:11.33Z",
      updatedAt: "2026-05-05T04:50:11.33Z",
      person: {
        ...makePatient().person,
        createdAt: "2026-05-05T04:50:11.33Z",
        updatedAt: "2026-05-05T04:50:11.33Z",
      },
    });
    const result = PatientListSchema.parse(normalizeDecimalValues([patient]));
    const first = result[0];
    expect(first).toBeDefined();
    expect(first?.createdAt).toBeInstanceOf(Date);
  });
});
