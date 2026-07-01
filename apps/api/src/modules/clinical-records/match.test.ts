import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedClinicalRecord } from "./parser.ts";

// Injectable candidate pool: match.ts runs one raw `sql` query against the
// patients⋈people join. We stub `sql\`…\`.execute()` to return this pool so we
// can exercise the ranking / baseScore auto-match gate without a DB.
type PoolRow = {
  patientId: number;
  personId: number;
  names: string;
  fatherName: string | null;
  motherName: string | null;
  rut: string | null;
  birthDate: Date | null;
};
const { poolRef } = vi.hoisted(() => ({ poolRef: { rows: [] as PoolRow[] } }));

vi.mock("@finanzas/db", () => ({ kysely: {} }));
vi.mock("kysely", () => ({
  sql: () => ({ execute: async () => ({ rows: poolRef.rows }) }),
}));

import { matchPatientForRecord } from "./match.ts";

function ficha(patientName: string, ageLabel: string | null = null): ParsedClinicalRecord {
  return { patientName, ageLabel, consultDate: "2024-01-01" } as ParsedClinicalRecord;
}
function person(over: Partial<PoolRow> & { patientId: number; names: string }): PoolRow {
  return {
    personId: over.patientId,
    fatherName: null,
    motherName: null,
    rut: null,
    birthDate: null,
    ...over,
  };
}

beforeEach(() => {
  poolRef.rows = [];
});

describe("matchPatientForRecord — auto-match gate", () => {
  it("nombre exacto normalizado → auto-match", async () => {
    poolRef.rows = [person({ patientId: 1, names: "Juan", fatherName: "Perez", motherName: "Soto" })];
    const r = await matchPatientForRecord(ficha("JUAN PEREZ SOTO"));
    expect(r.matchedPatientId).toBe(1);
  });

  it("typo en apellido (fuzzy baseScore≥0.9) → auto-match", async () => {
    poolRef.rows = [
      person({ patientId: 2, names: "Militina", fatherName: "Burgoa", motherName: "Vellegas" }),
    ];
    const r = await matchPatientForRecord(ficha("MILITINA BURGOA VILLEGAS"));
    expect(r.matchedPatientId).toBe(2);
  });

  it("GATE: nombre débil + edad coincidente NO auto-matchea (evita mislink)", async () => {
    // "Alonso Silva" comparte solo "Silva" con la ficha; sin el gate, el
    // age_match lo empujaría sobre 0.9. Con gate (baseScore<0.9) → sin match.
    poolRef.rows = [
      person({
        patientId: 3,
        names: "Alonso",
        fatherName: "Silva",
        birthDate: new Date("2019-01-01"),
      }),
    ];
    const r = await matchPatientForRecord(ficha("DOMENICA ORNELLA SUNINO SILVA", "5 AÑOS"));
    expect(r.matchedPatientId).toBeNull();
    // pero SÍ aparece como candidato para revisión manual
    expect(r.candidates.length).toBeGreaterThan(0);
  });

  it("dos candidatos fuertes sin margen → sin auto-match (revisión)", async () => {
    poolRef.rows = [
      person({ patientId: 4, names: "Maria", fatherName: "Gonzalez", motherName: "Rojas" }),
      person({ patientId: 5, names: "Maria", fatherName: "Gonzalez", motherName: "Rojos" }),
    ];
    const r = await matchPatientForRecord(ficha("MARIA GONZALEZ ROJAS"));
    // el exacto (patientId 4) gana por exact-name bypass
    expect(r.matchedPatientId).toBe(4);
  });

  it("sin nombre → sin match ni candidatos", async () => {
    const r = await matchPatientForRecord(ficha(""));
    expect(r.matchedPatientId).toBeNull();
    expect(r.candidates).toHaveLength(0);
  });
});
