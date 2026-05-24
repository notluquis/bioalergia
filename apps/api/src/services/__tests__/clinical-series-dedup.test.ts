import { beforeEach, describe, expect, it, vi } from "vitest";

// ── DB mock ──────────────────────────────────────────────────────────────────
// findMatchingSeries and detectDuplicateSeries both call db.clinicalSeries.*.
// Hoist the mocks via vi.hoisted so both vi.mock factories below can route
// to the same fns. Some services pull from @finanzas/db, others from
// @finanzas/db/slices (sliced ZenStack client) — both should see the same
// mockFindMany / mockFindFirst / mockFindUnique.

const { mockFindMany, mockFindFirst, mockFindSkinTests, mockFindUnique, mockDb } = vi.hoisted(
  () => {
    const mockFindMany = vi.fn();
    const mockFindFirst = vi.fn();
    const mockFindSkinTests = vi.fn();
    const mockFindUnique = vi.fn();
    const mockDb = {
      $queryRaw: (...args: unknown[]) => mockFindSkinTests(...args),
      clinicalSeries: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        findMany: (...args: unknown[]) => mockFindMany(...args),
        findUnique: (...args: unknown[]) => mockFindUnique(...args),
      },
    };
    return { mockFindMany, mockFindFirst, mockFindSkinTests, mockFindUnique, mockDb };
  }
);

vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { detectDuplicateSeries, findMatchingSeries, selectRepresentativeClinicalIdentity } =
  await import("../clinical-series.ts");

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSeries(
  id: number,
  patientName: string | null,
  patientRut: string | null,
  kind: "SUBCUTANEOUS_TREATMENT" | "SKIN_TEST" | "PATCH_TEST",
  eventCount = 3,
  extras?: {
    beneficiaryName?: string | null;
    beneficiaryPhones?: unknown;
    beneficiaryRut?: string | null;
    events?: Array<{
      description?: null | string;
      endDate?: Date | null;
      endDateTime?: Date | null;
      startDate?: Date | null;
      startDateTime?: Date | null;
      summary?: null | string;
    }>;
    patientId?: number | null;
    patientPhones?: unknown;
  }
) {
  return {
    beneficiaryName: extras?.beneficiaryName ?? null,
    beneficiaryPhones: extras?.beneficiaryPhones ?? null,
    beneficiaryRut: extras?.beneficiaryRut ?? null,
    events: (extras?.events ?? []).map((event) => ({
      description: event.description ?? null,
      endDate: event.endDate ?? null,
      endDateTime: event.endDateTime ?? null,
      startDate: event.startDate ?? null,
      startDateTime: event.startDateTime ?? null,
      summary: event.summary ?? null,
    })),
    id,
    kind,
    patientId: extras?.patientId ?? null,
    patientName,
    patientPhones: extras?.patientPhones ?? null,
    patientRut,
    _count: { events: eventCount },
  };
}

// ── detectDuplicateSeries ────────────────────────────────────────────────────

describe("detectDuplicateSeries — same RUT, different name (subset)", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockFindMany.mockReset();
    mockFindSkinTests.mockReset();
    mockFindSkinTests.mockResolvedValue([]);
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
      targetId: 957,
      sourceId: 780,
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

  it("detects skin-test series split between calendar event and imported XLSX", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(224, "Isaac Chacon chavez", "25416248-5", "SKIN_TEST", 1, {
        events: [{ startDateTime: new Date("2026-03-20T17:45:00.000Z") }],
        patientId: 6134,
      }),
      makeSeries(9525, "Isaac Chacon chavez", "25.416.248-5", "SKIN_TEST", 0, {
        patientId: 6134,
      }),
    ]);
    mockFindSkinTests.mockResolvedValueOnce([
      { clinicalSeriesId: 9525, testDate: new Date("2026-03-20T00:00:00.000Z") },
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toMatchObject({
      confidence: "high",
      kind: "SKIN_TEST",
      reason: "Mismo paciente y misma fecha clínica entre evento y examen",
      sourceId: 9525,
      targetId: 224,
    });
  });

  it("detects skin-test split by exact patient name and clinical date when the event lacks RUT", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(1455, "emilia jorquera becerra", null, "SKIN_TEST", 1, {
        events: [{ startDate: new Date("2026-01-09T00:00:00.000Z") }],
      }),
      makeSeries(9469, "Emilia Jorquera Becerra", "25.129.069-5", "SKIN_TEST", 0),
    ]);
    mockFindSkinTests.mockResolvedValueOnce([
      { clinicalSeriesId: 9469, testDate: new Date("2026-01-09T00:00:00.000Z") },
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toMatchObject({
      confidence: "high",
      kind: "SKIN_TEST",
      reason: "Mismo nombre y misma fecha clínica entre evento y examen",
      sourceId: 9469,
      targetId: 1455,
    });
  });

  it("does not use name-only skin-test pairing when clinical dates differ", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(49, "agustin silva", null, "SKIN_TEST", 1, {
        events: [{ startDate: new Date("2020-06-17T00:00:00.000Z") }],
      }),
      makeSeries(7813, "AGUSTIN SILVA", "12.345.678-5", "SKIN_TEST", 0),
    ]);
    mockFindSkinTests.mockResolvedValueOnce([
      { clinicalSeriesId: 7813, testDate: new Date("2019-06-15T00:00:00.000Z") },
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toMatchObject({
      reason: "Mismo nombre de paciente (AGUSTIN SILVA)",
      sourceId: 49,
      targetId: 7813,
    });
  });

  it("detects same-day skin-test imports split by exact name and close RUT typo", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(8114, "FELIPE CANDIA GONZALEZ", "26.536.164-7", "SKIN_TEST", 0),
      makeSeries(6801, "FELIPE CANDIA GONZALEZ", "23.536.164-7", "SKIN_TEST", 0),
    ]);
    mockFindSkinTests.mockResolvedValueOnce([
      { clinicalSeriesId: 8114, testDate: new Date("2021-06-04T00:00:00.000Z") },
      { clinicalSeriesId: 6801, testDate: new Date("2021-06-04T00:00:00.000Z") },
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toMatchObject({
      confidence: "high",
      kind: "SKIN_TEST",
      reason: "Mismo nombre, RUT cercano y fecha clínica entre exámenes",
    });
  });

  it("does not use close-RUT skin-test import pairing when clinical dates differ", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(9929, "ISIDORA HORMAZABAL", "23.022.624-5", "SKIN_TEST", 0),
      makeSeries(6662, "ISIDORA HORMAZABAL", "23.022.625-5", "SKIN_TEST", 0),
    ]);
    mockFindSkinTests.mockResolvedValueOnce([
      { clinicalSeriesId: 9929, testDate: new Date("2017-11-16T00:00:00.000Z") },
      { clinicalSeriesId: 6662, testDate: new Date("2017-11-13T00:00:00.000Z") },
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(1);
    expect(dupes[0]?.reason).toBe("Mismo nombre de paciente (ISIDORA HORMAZABAL)");
  });

  it("detects skin-test event/import split with exact RUT and a one-day date drift", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(372, "pedro monsalves matamala", "21.946.529-7", "SKIN_TEST", 1, {
        events: [
          {
            startDate: new Date("2025-01-27T00:00:00.000Z"),
            summary: "confirma test cutaneo ambiental Pedro Monsalves Matamala",
          },
        ],
      }),
      makeSeries(9984, "Pedro Monsalves Matamala", "21.946.529-7", "SKIN_TEST", 0),
    ]);
    mockFindSkinTests.mockResolvedValueOnce([
      { clinicalSeriesId: 9984, testDate: new Date("2025-01-28T00:00:00.000Z") },
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toMatchObject({
      reason: "Mismo paciente probable y fecha clínica cercana entre evento y examen",
      sourceId: 9984,
      targetId: 372,
    });
  });

  it("detects skin-test event/import split by exact name and exam text with a two-day date drift", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(4166, "dominique cisterna munoz", null, "SKIN_TEST", 1, {
        events: [
          {
            startDate: new Date("2023-04-17T00:00:00.000Z"),
            summary: "confirmada test cutaneo aeroalergeno pediatrico Dominique Cisterna Muñoz",
          },
        ],
      }),
      makeSeries(8966, "Dominique Cisterna Muñoz", "24.268.215-3", "SKIN_TEST", 0),
    ]);
    mockFindSkinTests.mockResolvedValueOnce([
      { clinicalSeriesId: 8966, testDate: new Date("2023-04-15T00:00:00.000Z") },
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toMatchObject({
      reason: "Mismo paciente probable y fecha clínica cercana entre evento y examen",
      sourceId: 8966,
      targetId: 4166,
    });
  });

  it("does not use near-date name pairing when the event text is not a skin-test event", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(1, "dominique cisterna munoz", null, "SKIN_TEST", 1, {
        events: [
          {
            startDate: new Date("2023-04-17T00:00:00.000Z"),
            summary: "control medico Dominique Cisterna Muñoz",
          },
        ],
      }),
      makeSeries(2, "Dominique Cisterna Muñoz", "24.268.215-3", "SKIN_TEST", 0),
    ]);
    mockFindSkinTests.mockResolvedValueOnce([
      { clinicalSeriesId: 2, testDate: new Date("2023-04-15T00:00:00.000Z") },
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(1);
    expect(dupes[0]?.reason).toBe("Mismo nombre de paciente (Dominique Cisterna Muñoz)");
  });

  it("does NOT merge different RUTs even when names are similar", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(1, "juan perez garcia", "12345678-5", "SUBCUTANEOUS_TREATMENT", 3),
      makeSeries(2, "juan perez garcia", "98765432-1", "SUBCUTANEOUS_TREATMENT", 3),
    ]);

    // Same name but different valid patient RUTs should be treated as distinct
    // people, not as a name-based duplicate.
    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(0);
  });

  it("merges ALL same-RUT series into one target in a single pass", async () => {
    // Real case from DB: RUT 15198025-2 had 3 series (617, 5966, 5976).
    // Previously only one pair was detected per pass (break after first match).
    // Now all sources are collected under the lowest-id target in one pass.
    mockFindMany.mockResolvedValueOnce([
      makeSeries(617, "varela zambrano", "15198025-2", "SUBCUTANEOUS_TREATMENT", 8),
      makeSeries(5966, "karen varela zambrano", "15198025-2", "SUBCUTANEOUS_TREATMENT", 2),
      makeSeries(5976, "karen varela zambrano", "15198025-2", "SUBCUTANEOUS_TREATMENT", 1),
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(2);
    expect(dupes.every((d) => d.targetId === 617)).toBe(true);
    expect(dupes.map((d) => d.sourceId).sort((a, b) => a - b)).toEqual([5966, 5976]);
  });

  it("merges 4 same-RUT series into one target (real case: ojeda carrasco)", async () => {
    // Real case from DB: RUT 26606696-1 had 4 series (10, 6227, 6228, 6229).
    // Old code detected pairs (10→6227) and (6228→6229) — leaving two series
    // after the first merge pass. New code merges all into target 10.
    mockFindMany.mockResolvedValueOnce([
      makeSeries(10, "jose ojeda carrasco", "26606696-1", "SUBCUTANEOUS_TREATMENT", 9),
      makeSeries(6227, "jose luis ojeda", "26606696-1", "SUBCUTANEOUS_TREATMENT", 1),
      makeSeries(6228, "jose luis ojeda", "26606696-1", "SUBCUTANEOUS_TREATMENT", 1),
      makeSeries(6229, "jose luis ojeda", "26606696-1", "SUBCUTANEOUS_TREATMENT", 1),
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(3);
    expect(dupes.every((d) => d.targetId === 10)).toBe(true);
    expect(dupes.map((d) => d.sourceId).sort((a, b) => a - b)).toEqual([6227, 6228, 6229]);
  });

  it("prefers the better-populated canonical series over the oldest id for exact-name duplicates", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(36, "cristian araneda ulloa", null, "SUBCUTANEOUS_TREATMENT", 10, {
        beneficiaryName: "araneda ulloa",
      }),
      makeSeries(5988, "cristian araneda ulloa", "14213239-7", "SUBCUTANEOUS_TREATMENT", 27, {
        beneficiaryName: "araneda ulloa",
      }),
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toMatchObject({
      targetId: 5988,
      sourceId: 36,
    });
  });

  it("does not flag same-name duplicates when both series have distinct patient RUTs", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(375, "catalina valenzuela", "24615586-0", "SKIN_TEST", 1, {
        beneficiaryName: "Catalina Ignacia Valenzuela Cortes",
        beneficiaryRut: "24615586-0",
      }),
      makeSeries(4608, "catalina valenzuela", "26342739-4", "SKIN_TEST", 1),
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(0);
  });

  it("does not flag family-member series as duplicates just because phone and beneficiary overlap", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(6659, "paloma olate quintana", "23724084-7", "SKIN_TEST", 1, {
        beneficiaryName: "Paloma Olate Quintana",
        beneficiaryRut: "23724084-7",
        patientPhones: ["+56971027317"],
      }),
      makeSeries(6660, "rayen olate quintana", "27717558-4", "SKIN_TEST", 1, {
        beneficiaryName: "Paloma Olate Quintana",
        beneficiaryRut: "23724084-7",
        patientPhones: ["+56971027317"],
      }),
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(0);
  });

  it("detects duplicate by same phone + compatible name when one series lacks patient RUT", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(1001, "pablo miguel reyes gacitua", "16612125-6", "SUBCUTANEOUS_TREATMENT", 3, {
        patientPhones: ["+56963080233"],
      }),
      makeSeries(1002, "pablo reyes gacitua", null, "SUBCUTANEOUS_TREATMENT", 1, {
        patientPhones: ["+56963080233"],
      }),
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toMatchObject({
      confidence: "medium",
      kind: "SUBCUTANEOUS_TREATMENT",
      sourceId: 1002,
      targetId: 1001,
    });
  });

  it("detects duplicate by same phone derived from multiline event text", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(64, "Marcelo Vallejos Mora", "20519220-4", "SUBCUTANEOUS_TREATMENT", 14, {
        events: [
          {
            description: "996189131\n24 años\n20.519.220-4\nsebastianvallejosmora@gmail.com",
            summary: "llego Marcelo Vallejos Mora, vacuna clustoid dosis mensual (50)",
          },
        ],
        patientPhones: null,
      }),
      makeSeries(6401, "marcelo vallejos", null, "SUBCUTANEOUS_TREATMENT", 1, {
        events: [
          {
            description: "996189131\n24 años\n20.519.220-4",
            summary: "llego vacuna marcelo vallejos, vacuna clustoid dosis mensual (50)",
          },
        ],
        patientPhones: null,
      }),
    ]);

    const dupes = await detectDuplicateSeries();

    expect(dupes).toHaveLength(1);
    expect(dupes[0]).toMatchObject({
      confidence: "medium",
      kind: "SUBCUTANEOUS_TREATMENT",
      sourceId: 6401,
      targetId: 64,
    });
  });

  it("assigns exact-name rebuild matches to the better canonical series, not the oldest id", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockFindMany.mockResolvedValueOnce([
      {
        _count: { events: 2 },
        beneficiaryName: "araneda ulloa",
        beneficiaryRut: null,
        events: [
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2024-01-01T00:00:00.000Z"),
            startDateTime: null,
          },
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2024-02-01T00:00:00.000Z"),
            startDateTime: null,
          },
        ],
        id: 36,
        patientName: "cristian araneda ulloa",
        patientRut: null,
      },
      {
        _count: { events: 4 },
        beneficiaryName: "araneda ulloa",
        beneficiaryRut: null,
        events: [
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2025-01-01T00:00:00.000Z"),
            startDateTime: null,
          },
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2025-06-01T00:00:00.000Z"),
            startDateTime: null,
          },
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2025-12-01T00:00:00.000Z"),
            startDateTime: null,
          },
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2026-02-01T00:00:00.000Z"),
            startDateTime: null,
          },
        ],
        id: 5988,
        patientName: "cristian araneda ulloa",
        patientRut: "14213239-7",
      },
    ]);

    const match = await findMatchingSeries({
      eventDate: "2026-03-01",
      kind: "SUBCUTANEOUS_TREATMENT",
      patientName: "cristian araneda ulloa",
      patientRut: null,
    });

    expect(match).toBe(5988);
  });

  it("prefers the canonical exact-name duplicate when the source event has no patient RUT", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(47, "vicente agustin paredes cruces", null, "SUBCUTANEOUS_TREATMENT", 15),
      makeSeries(707, "vicente agustin paredes cruces", "21335160-5", "SUBCUTANEOUS_TREATMENT", 4),
    ]);

    const match = await findMatchingSeries({
      eventDate: "2026-03-01",
      kind: "SUBCUTANEOUS_TREATMENT",
      patientName: "vicente agustin paredes cruces",
      patientRut: null,
    });

    expect(match).toBe(707);
  });

  it("prefers the canonical exact-name duplicate when patient and beneficiary RUT are swapped", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(49, "franco munoz jara", "13300260-K", "SUBCUTANEOUS_TREATMENT", 14, {
        beneficiaryName: "ximena jara suazo",
        beneficiaryRut: "21850411-6",
      }),
      makeSeries(5962, "franco munoz jara", "21850411-6", "SUBCUTANEOUS_TREATMENT", 21, {
        beneficiaryName: "ximena jara suazo",
        beneficiaryRut: "13300260-K",
      }),
    ]);

    const match = await findMatchingSeries({
      beneficiaryRut: "21850411-6",
      eventDate: "2026-03-01",
      kind: "SUBCUTANEOUS_TREATMENT",
      patientName: "franco munoz jara",
      patientRut: "13300260-K",
    });

    expect(match).toBe(5962);
  });

  it("prefers the canonical exact-name duplicate when the incoming patient RUT is a one-digit typo", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeSeries(1403, "esteban escobar ortiz", "20159822-2", "SUBCUTANEOUS_TREATMENT", 2),
      makeSeries(1671, "esteban escobar ortiz", "23159822-2", "SUBCUTANEOUS_TREATMENT", 2),
    ]);

    const match = await findMatchingSeries({
      eventDate: "2026-03-01",
      kind: "SUBCUTANEOUS_TREATMENT",
      patientName: "esteban escobar ortiz",
      patientRut: "23159822-2",
    });

    expect(match).toBe(1403);
  });

  it("prefers the fuller canonical series when the incoming event only has a partial last name", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockFindMany.mockResolvedValueOnce([]);
    mockFindMany.mockResolvedValueOnce([]);
    mockFindMany.mockResolvedValueOnce([
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2025-01-01T00:00:00.000Z"),
            startDateTime: null,
          },
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2025-02-01T00:00:00.000Z"),
            startDateTime: null,
          },
        ],
        id: 1682,
        patientName: "yolerana chavez",
        patientRut: null,
      },
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2025-10-01T00:00:00.000Z"),
            startDateTime: null,
          },
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2025-11-01T00:00:00.000Z"),
            startDateTime: null,
          },
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2025-12-01T00:00:00.000Z"),
            startDateTime: null,
          },
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2026-01-01T00:00:00.000Z"),
            startDateTime: null,
          },
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2026-02-01T00:00:00.000Z"),
            startDateTime: null,
          },
        ],
        id: 5969,
        patientName: "yolerana chavez seguel",
        patientRut: "13512855-4",
      },
    ]);

    const match = await findMatchingSeries({
      eventDate: "2026-02-15",
      kind: "SUBCUTANEOUS_TREATMENT",
      patientName: "yolerana chavez",
      patientRut: null,
    });

    expect(match).toBe(5969);
  });

  it("matches by compatible name even when the incoming event already has a patient RUT", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockFindMany.mockResolvedValueOnce([]);
    mockFindMany.mockResolvedValueOnce([]);
    mockFindMany.mockResolvedValueOnce([
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2022-11-28T00:00:00.000Z"),
            startDateTime: null,
          },
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2025-03-03T00:00:00.000Z"),
            startDateTime: null,
          },
        ],
        id: 585,
        patientName: "alyson gajardo arriagada",
        patientRut: null,
      },
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2025-12-17T00:00:00.000Z"),
            startDateTime: null,
          },
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2026-02-17T00:00:00.000Z"),
            startDateTime: null,
          },
        ],
        id: 114,
        patientName: "alyson tamara gajardo arriagada",
        patientRut: "19108687-2",
      },
    ]);

    const match = await findMatchingSeries({
      eventDate: "2026-02-17",
      kind: "SUBCUTANEOUS_TREATMENT",
      patientName: "alyson tamara gajardo arriagada",
      patientRut: "19108687-2",
    });

    expect(match).toBe(114);
  });

  it("matches same-kind series by shared phone plus compatible name", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockFindMany.mockResolvedValueOnce([]);
    mockFindMany.mockResolvedValueOnce([]);
    mockFindMany.mockResolvedValueOnce([
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2022-09-12T00:00:00.000Z"),
            startDateTime: null,
          },
        ],
        id: 6741,
        patientName: "valeria palma onetto",
        patientPhones: ["+56937039005"],
        patientRut: null,
      },
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2025-09-13T00:00:00.000Z"),
            startDateTime: null,
          },
        ],
        id: 345,
        patientName: "valeria danae palma onetto",
        patientPhones: ["+56937039005"],
        patientRut: "17678131-9",
      },
    ]);

    const match = await findMatchingSeries({
      eventDate: "2025-09-13",
      kind: "SKIN_TEST",
      patientName: "valeria danae palma onetto",
      patientPhones: ["+56937039005"],
      patientRut: "17678131-9",
    });

    expect(match).toBe(345);
  });

  it("prefers the stronger canonical series over the exact short-name series when phone matches", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockFindMany.mockResolvedValueOnce([
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2022-09-12T00:00:00.000Z"),
            startDateTime: null,
          },
        ],
        id: 6741,
        patientName: "valeria palma onetto",
        patientPhones: ["+56937039005"],
        patientRut: null,
      },
    ]);
    mockFindMany.mockResolvedValueOnce([
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2022-09-12T00:00:00.000Z"),
            startDateTime: null,
          },
        ],
        id: 6741,
        patientName: "valeria palma onetto",
        patientPhones: ["+56937039005"],
        patientRut: null,
      },
    ]);
    mockFindMany.mockResolvedValueOnce([
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2022-09-12T00:00:00.000Z"),
            startDateTime: null,
          },
        ],
        id: 6741,
        patientName: "valeria palma onetto",
        patientPhones: ["+56937039005"],
        patientRut: null,
      },
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2025-09-13T00:00:00.000Z"),
            startDateTime: null,
          },
        ],
        id: 345,
        patientName: "valeria danae palma onetto",
        patientPhones: ["+56937039005"],
        patientRut: "17678131-9",
      },
    ]);

    const match = await findMatchingSeries({
      eventDate: "2022-09-12",
      kind: "SKIN_TEST",
      patientName: "valeria palma onetto",
      patientPhones: ["+56937039005"],
      patientRut: null,
    });

    expect(match).toBe(345);
  });

  it("derives phones from series events when stored patientPhones are missing", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockFindMany.mockResolvedValueOnce([
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          {
            description: "Valeria Palma Onetto\n937039005",
            endDate: null,
            endDateTime: null,
            startDate: new Date("2022-09-12T00:00:00.000Z"),
            startDateTime: null,
            summary: "LLEGO, Test cutáneo Aero ambiental 40 mil, Valeria Palma Onetto",
          },
        ],
        id: 6741,
        patientName: "valeria palma onetto",
        patientPhones: null,
        patientRut: null,
      },
    ]);
    mockFindMany.mockResolvedValueOnce([
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          {
            description: "Valeria Palma Onetto\n937039005",
            endDate: null,
            endDateTime: null,
            startDate: new Date("2022-09-12T00:00:00.000Z"),
            startDateTime: null,
            summary: "LLEGO, Test cutáneo Aero ambiental 40 mil, Valeria Palma Onetto",
          },
        ],
        id: 6741,
        patientName: "valeria palma onetto",
        patientPhones: null,
        patientRut: null,
      },
    ]);
    mockFindMany.mockResolvedValueOnce([
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          {
            description: "Valeria Palma Onetto\n937039005",
            endDate: null,
            endDateTime: null,
            startDate: new Date("2022-09-12T00:00:00.000Z"),
            startDateTime: null,
            summary: "LLEGO, Test cutáneo Aero ambiental 40 mil, Valeria Palma Onetto",
          },
        ],
        id: 6741,
        patientName: "valeria palma onetto",
        patientPhones: null,
        patientRut: null,
      },
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          {
            description: "Valeria Danae Palma Onetto\n17678131-9\n937039005",
            endDate: null,
            endDateTime: null,
            startDate: new Date("2025-09-13T00:00:00.000Z"),
            startDateTime: null,
            summary: "llegoValeria Danae Palma Onetto, test cutaneo ambiental (30)",
          },
        ],
        id: 345,
        patientName: "valeria danae palma onetto",
        patientPhones: null,
        patientRut: "17678131-9",
      },
    ]);

    const match = await findMatchingSeries({
      eventDate: "2022-09-12",
      kind: "SKIN_TEST",
      patientName: "valeria palma onetto",
      patientPhones: ["+56937039005"],
      patientRut: null,
    });

    expect(match).toBe(345);
  });

  it("prefers the stronger canonical series when the rut-only match is actually the beneficiary rut", async () => {
    mockFindFirst.mockResolvedValueOnce({
      beneficiaryName: null,
      beneficiaryRut: null,
      events: [
        {
          endDate: null,
          endDateTime: null,
          startDate: new Date("2026-03-20T00:00:00.000Z"),
          startDateTime: null,
        },
      ],
      id: 7001,
      patientName: "sofia osses flores",
      patientRut: "14057372-8",
    });
    mockFindMany.mockResolvedValueOnce([
      {
        _count: { events: 1 },
        beneficiaryName: null,
        beneficiaryRut: null,
        id: 7001,
        patientName: "sofia osses flores",
        patientRut: "14057372-8",
      },
    ]);
    mockFindMany.mockResolvedValueOnce([
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2026-03-20T00:00:00.000Z"),
            startDateTime: null,
          },
        ],
        id: 7001,
        patientName: "sofia osses flores",
        patientRut: "14057372-8",
      },
    ]);
    mockFindMany.mockResolvedValueOnce([
      {
        beneficiaryName: "daniel antonio flores silva",
        beneficiaryRut: "14057372-8",
        events: [
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2023-01-12T00:00:00.000Z"),
            startDateTime: null,
          },
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2026-02-23T00:00:00.000Z"),
            startDateTime: null,
          },
        ],
        id: 789,
        patientName: "sofia alejandra osses flores",
        patientPhones: ["+56976156191"],
        patientRut: "20363939-2",
      },
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2026-03-20T00:00:00.000Z"),
            startDateTime: null,
          },
        ],
        id: 7001,
        patientName: "sofia osses flores",
        patientPhones: ["+56976156191"],
        patientRut: "14057372-8",
      },
    ]);

    const match = await findMatchingSeries({
      beneficiaryRut: "14057372-8",
      eventDate: "2026-03-20",
      kind: "SUBCUTANEOUS_TREATMENT",
      patientName: "sofia osses flores",
      patientPhones: ["+56976156191"],
      patientRut: "14057372-8",
    });

    expect(match).toBe(789);
  });

  it("does not match a different patient just because a surname is repeated twice", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    mockFindMany.mockResolvedValueOnce([]);
    mockFindMany.mockResolvedValueOnce([]);
    mockFindMany.mockResolvedValueOnce([
      {
        beneficiaryName: "MACARENA PATRICIA MUNOZ PARRA",
        beneficiaryRut: "15589687-6",
        events: [
          {
            endDate: null,
            endDateTime: null,
            startDate: new Date("2024-01-01T00:00:00.000Z"),
            startDateTime: null,
          },
        ],
        id: 257,
        patientName: "matias allende munoz",
        patientRut: "15589687-6",
      },
    ]);

    const match = await findMatchingSeries({
      eventDate: "2024-02-01",
      kind: "SUBCUTANEOUS_TREATMENT",
      patientName: "sara munoz munoz san carlos",
      patientRut: null,
    });

    expect(match).toBeNull();
  });
});

describe("selectRepresentativeClinicalIdentity", () => {
  it("chooses the dominant patient identity across events instead of the first outlier", () => {
    const identity = selectRepresentativeClinicalIdentity([
      {
        description: null,
        summary: "llego vacuna clustoid natalia mardones mardones 18110888-6",
      },
      {
        description: null,
        summary: "llego vacuna clustoid natalia mardones mardones 18110888-6",
      },
      {
        description: null,
        summary: "llego vacuna clustoid natalia mardones mardones 18110888-6",
      },
      {
        description: null,
        summary: "llego vacuna clustoid benjamin mardones parra 23794542-5",
      },
    ]);

    expect(identity).toMatchObject({
      patientName: "natalia mardones mardones",
      patientRut: "18110888-6",
    });
  });
});
