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
