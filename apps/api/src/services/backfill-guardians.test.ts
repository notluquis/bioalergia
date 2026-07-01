import { beforeEach, describe, expect, it, vi } from "vitest";

type Pair = { patientRut: string; beneficiaryRut: string; beneficiaryName: string | null };
const { selectRef } = vi.hoisted(() => ({ selectRef: { rows: [] as Pair[] } }));
const { resolvePerson } = vi.hoisted(() => ({ resolvePerson: vi.fn() }));

vi.mock("@finanzas/db", () => ({ kysely: {} }));
vi.mock("kysely", () => ({
  sql: () => ({ execute: async () => ({ rows: selectRef.rows, numAffectedRows: 1n }) }),
}));
vi.mock("./identity-resolver.ts", () => ({ resolvePerson }));

import { runBackfillGuardians } from "./backfill-guardians.ts";

beforeEach(() => {
  vi.clearAllMocks();
  selectRef.rows = [];
});

describe("runBackfillGuardians", () => {
  it("dry-run: cuenta pares con RUTs válidos, NO resuelve", async () => {
    selectRef.rows = [
      { patientRut: "20254417-7", beneficiaryRut: "10274152-8", beneficiaryName: "Madre" },
      { patientRut: "AA", beneficiaryRut: "BB", beneficiaryName: null }, // inválido
    ];
    const r = await runBackfillGuardians({ dryRun: true });
    expect(resolvePerson).not.toHaveBeenCalled();
    expect(r).toMatchObject({ pairs: 2, linked: 1, skippedInvalidRut: 1 });
  });

  it("write: resuelve paciente(child)+guardian(parent) y linkea", async () => {
    selectRef.rows = [
      { patientRut: "20254417-7", beneficiaryRut: "10274152-8", beneficiaryName: "Madre" },
    ];
    resolvePerson
      .mockResolvedValueOnce({ patientId: 5, personId: 5, created: false, action: "linked" }) // child
      .mockResolvedValueOnce({ patientId: null, personId: 8, created: false, action: "linked" }); // guardian
    const r = await runBackfillGuardians({ dryRun: false });
    expect(resolvePerson).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ pairs: 1, linked: 1, skippedUnresolved: 0 });
  });

  it("write: RUT inválido saltado sin resolver", async () => {
    selectRef.rows = [{ patientRut: "1-2", beneficiaryRut: "3-4", beneficiaryName: null }];
    const r = await runBackfillGuardians({ dryRun: false });
    expect(resolvePerson).not.toHaveBeenCalled();
    expect(r).toMatchObject({ skippedInvalidRut: 1, linked: 0 });
  });
});
