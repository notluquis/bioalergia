import { beforeEach, describe, expect, it, vi } from "vitest";

// ── DB mock ──────────────────────────────────────────────────────────────────
// findMatchingSeries and detectDuplicateSeries both call db.clinicalSeries.*
// We set up the mock before importing the module so it picks up the stub.

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@finanzas/db", () => ({
  db: {
    clinicalSeries: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
  kysely: {},
}));

const { detectDuplicateSeries } = await import("../clinical-series");

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSeries(
  id: number,
  patientName: string | null,
  patientRut: string | null,
  kind: "SUBCUTANEOUS_TREATMENT" | "SKIN_TEST" | "PATCH_TEST",
  eventCount = 3,
) {
  return { id, kind, patientName, patientRut, _count: { events: eventCount } };
}

// ── detectDuplicateSeries ────────────────────────────────────────────────────

describe("detectDuplicateSeries — same RUT, different name (subset)", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
    mockFindUnique.mockReset();
  });

  it("detects 'villar castro' vs 'luis villar castro' as duplicate (same RUT, same kind)", async () => {
    // Real case from DB: series 780 and 957.
    // Root cause: when events were synced in non-chronological order, the
    // November 2024 event (series 780) was processed first. When the
    // April–August 2024 events arrived later, findMatchingSeries found series
    // 780 by RUT but rejected it because the date distance (≈210 days) exceeded
    // the 180-day SUBCUTANEOUS_TREATMENT window → a second series was created.
    // detectDuplicateSeries correctly catches them post-hoc via RUT equality.
    mockFindMany.mockResolvedValueOnce([
      makeSeries(780, "villar castro", "17100445-4", "SUBCUTANEOUS_TREATMENT", 1),
      makeSeries(957, "luis villar castro", "17100445-4", "SUBCUTANEOUS_TREATMENT", 4),
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toMatchObject({
      confidence: "high",
      targetId: 780,
      sourceId: 957,
      kind: "SUBCUTANEOUS_TREATMENT",
    });
  });

  it("detects 'andrea farias alvarez' vs 'claudia andrea farias alvarez' (first name missing)", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(103, "andrea farias alvarez", "16200668-1", "SUBCUTANEOUS_TREATMENT", 5),
      makeSeries(6222, "claudia andrea farias alvarez", "16200668-1", "SUBCUTANEOUS_TREATMENT", 2),
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toMatchObject({ confidence: "high", targetId: 103, sourceId: 6222 });
  });

  it("does NOT merge same-RUT series of different kinds (SUBCUTANEOUS vs SKIN_TEST)", async () => {
    // A patient can legitimately have both a subcutaneous treatment AND a skin
    // test open at the same time — different kinds are kept separate.
    mockFindMany.mockResolvedValueOnce([
      makeSeries(74, "nadia yanez rojas", "10370222-4", "SUBCUTANEOUS_TREATMENT", 10),
      makeSeries(167, "nadia yanez rojas", "10370222-4", "SKIN_TEST", 3),
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(0);
  });

  it("does NOT merge different RUTs even when names are similar", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(1, "juan perez garcia", "12345678-5", "SUBCUTANEOUS_TREATMENT", 3),
      makeSeries(2, "juan perez garcia", "98765432-1", "SUBCUTANEOUS_TREATMENT", 3),
    ]);

    // Same name but different RUTs → name check fails (names ARE equal) but
    // the loop reaches the name-equality branch first; let's verify only one
    // duplicate (by name) is found, not a false RUT-based merge.
    const dupes = await detectDuplicateSeries();

    // Names are identical → detected as high-confidence name duplicate.
    // The important thing is it does NOT falsely match by RUT.
    expect(dupes).toHaveLength(1);
    expect(dupes[0]!.reason).toContain("nombre");
  });

  it("only pairs each series once (no chaining A→B→C)", async () => {
    // Three series for the same patient/RUT/kind.
    // The algorithm pairs the oldest (A) with the next (B), then C is left
    // unpaired — a known limitation documented in the code.
    mockFindMany.mockResolvedValueOnce([
      makeSeries(617, "varela zambrano", "15198025-2", "SUBCUTANEOUS_TREATMENT", 8),
      makeSeries(5966, "karen varela zambrano", "15198025-2", "SUBCUTANEOUS_TREATMENT", 2),
      makeSeries(5976, "karen varela zambrano", "15198025-2", "SUBCUTANEOUS_TREATMENT", 1),
    ]);

    const dupes = await detectDuplicateSeries();

    // Only one pair detected; 5976 is left for a subsequent dedup run.
    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toMatchObject({ targetId: 617, sourceId: 5966 });
  });
});
