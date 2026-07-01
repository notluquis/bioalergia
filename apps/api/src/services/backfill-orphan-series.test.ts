import { beforeEach, describe, expect, it, vi } from "vitest";

type OrphanRow = { id: number; patientName: string | null; patientRut: string | null };
const { selectRef } = vi.hoisted(() => ({ selectRef: { rows: [] as OrphanRow[] } }));
const { resolvePerson } = vi.hoisted(() => ({ resolvePerson: vi.fn() }));

vi.mock("@finanzas/db", () => ({ kysely: {} }));
vi.mock("kysely", () => ({
  // First call (SELECT) returns the orphan rows; UPDATEs also route here and
  // return them harmlessly (the caller ignores the result).
  sql: () => ({ execute: async () => ({ rows: selectRef.rows }) }),
}));
vi.mock("./identity-resolver.ts", () => ({ resolvePerson }));

import { runBackfillOrphanSeries } from "./backfill-orphan-series.ts";

beforeEach(() => {
  vi.clearAllMocks();
  selectRef.rows = [];
});

describe("runBackfillOrphanSeries", () => {
  it("dry-run: cuenta linkeables por RUT, NO resuelve (read-only)", async () => {
    selectRef.rows = [
      { id: 1, patientName: "Juan Perez", patientRut: "12345678-5" },
      { id: 2, patientName: "Sin Rut", patientRut: null },
    ];
    const r = await runBackfillOrphanSeries({ dryRun: true });
    expect(resolvePerson).not.toHaveBeenCalled();
    expect(r).toMatchObject({ dryRun: true, orphans: 2, linked: 1, skippedNoRut: 1 });
  });

  it("write: resuelve por RUT y linkea; salta sin-rut", async () => {
    selectRef.rows = [
      { id: 1, patientName: "Juan Perez", patientRut: "12345678-5" },
      { id: 2, patientName: "Sin Rut", patientRut: null },
    ];
    resolvePerson.mockResolvedValue({ patientId: 99, personId: 1, created: false, action: "linked" });
    const r = await runBackfillOrphanSeries({ dryRun: false });
    expect(resolvePerson).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ orphans: 2, linked: 1, skippedNoRut: 1, skippedUnresolved: 0 });
  });

  it("write: RUT irresoluble (patientId null) → skippedUnresolved", async () => {
    selectRef.rows = [{ id: 3, patientName: "Raro", patientRut: "1-9" }];
    resolvePerson.mockResolvedValue({ patientId: null, personId: null, created: false, action: "review" });
    const r = await runBackfillOrphanSeries({ dryRun: false });
    expect(r).toMatchObject({ linked: 0, skippedUnresolved: 1 });
  });
});
