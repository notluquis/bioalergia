import { parseDate } from "@internationalized/date";
import { describe, expect, it } from "vitest";
import { normalizeDecimalValues } from "./api";
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

describe("CalendarDate → ISO submit conversion", () => {
  // The CreatePatientModal stores birthDate as DateValue | null in form state
  // and converts to ISO string only at submit time. This pins the canonical
  // shape so a refactor can't accidentally re-introduce the string<->CalendarDate
  // dance that previously caused server-side z.string() invalid_type errors.
  it("CalendarDate.toString() yields canonical YYYY-MM-DD", () => {
    expect(parseDate("2000-10-17").toString()).toBe("2000-10-17");
  });

  it("null birthDate maps to undefined via optional chaining + nullish coalesce", () => {
    const value = null as { toString(): string } | null;
    expect(value?.toString() ?? undefined).toBeUndefined();
  });

  it("CalendarDate JSON serialization is NOT a string (regression guard)", () => {
    // If birthDate ever leaks as CalendarDate to the wire, JSON.stringify will
    // shape it as { calendar, era, year, month, day }. Server zod expects
    // string and rejects with invalid_type. This test documents WHY the
    // submit-time toString() call is required.
    const date = parseDate("2000-10-17");
    const json = JSON.parse(JSON.stringify(date)) as Record<string, unknown>;
    expect(typeof json).toBe("object");
    expect(json).not.toBe("2000-10-17");
    expect(json).toHaveProperty("year", 2000);
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
