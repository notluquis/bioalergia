import { beforeEach, describe, expect, it, vi } from "vitest";

// ── DB mock ──────────────────────────────────────────────────────────────────
// findMatchingSeries and detectDuplicateSeries both call db.clinicalSeries.*
// We set up the mock before importing the module so it picks up the stub.

const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@finanzas/db", () => ({
  db: {
    clinicalSeries: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
  kysely: {},
}));

const { detectDuplicateSeries, findMatchingSeries, selectRepresentativeClinicalIdentity } = await import("../clinical-series");

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
    events?: Array<{ description: null | string; summary: null | string }>;
    patientPhones?: unknown;
  },
) {
  return {
    beneficiaryName: extras?.beneficiaryName ?? null,
    beneficiaryPhones: extras?.beneficiaryPhones ?? null,
    beneficiaryRut: extras?.beneficiaryRut ?? null,
    events: extras?.events ?? [],
    id,
    kind,
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
          { endDate: null, endDateTime: null, startDate: new Date("2024-01-01T00:00:00.000Z"), startDateTime: null },
          { endDate: null, endDateTime: null, startDate: new Date("2024-02-01T00:00:00.000Z"), startDateTime: null },
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
          { endDate: null, endDateTime: null, startDate: new Date("2025-01-01T00:00:00.000Z"), startDateTime: null },
          { endDate: null, endDateTime: null, startDate: new Date("2025-06-01T00:00:00.000Z"), startDateTime: null },
          { endDate: null, endDateTime: null, startDate: new Date("2025-12-01T00:00:00.000Z"), startDateTime: null },
          { endDate: null, endDateTime: null, startDate: new Date("2026-02-01T00:00:00.000Z"), startDateTime: null },
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
          { endDate: null, endDateTime: null, startDate: new Date("2025-01-01T00:00:00.000Z"), startDateTime: null },
          { endDate: null, endDateTime: null, startDate: new Date("2025-02-01T00:00:00.000Z"), startDateTime: null },
        ],
        id: 1682,
        patientName: "yolerana chavez",
        patientRut: null,
      },
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          { endDate: null, endDateTime: null, startDate: new Date("2025-10-01T00:00:00.000Z"), startDateTime: null },
          { endDate: null, endDateTime: null, startDate: new Date("2025-11-01T00:00:00.000Z"), startDateTime: null },
          { endDate: null, endDateTime: null, startDate: new Date("2025-12-01T00:00:00.000Z"), startDateTime: null },
          { endDate: null, endDateTime: null, startDate: new Date("2026-01-01T00:00:00.000Z"), startDateTime: null },
          { endDate: null, endDateTime: null, startDate: new Date("2026-02-01T00:00:00.000Z"), startDateTime: null },
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
          { endDate: null, endDateTime: null, startDate: new Date("2022-11-28T00:00:00.000Z"), startDateTime: null },
          { endDate: null, endDateTime: null, startDate: new Date("2025-03-03T00:00:00.000Z"), startDateTime: null },
        ],
        id: 585,
        patientName: "alyson gajardo arriagada",
        patientRut: null,
      },
      {
        beneficiaryName: null,
        beneficiaryRut: null,
        events: [
          { endDate: null, endDateTime: null, startDate: new Date("2025-12-17T00:00:00.000Z"), startDateTime: null },
          { endDate: null, endDateTime: null, startDate: new Date("2026-02-17T00:00:00.000Z"), startDateTime: null },
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
          { endDate: null, endDateTime: null, startDate: new Date("2022-09-12T00:00:00.000Z"), startDateTime: null },
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
          { endDate: null, endDateTime: null, startDate: new Date("2025-09-13T00:00:00.000Z"), startDateTime: null },
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
          { endDate: null, endDateTime: null, startDate: new Date("2022-09-12T00:00:00.000Z"), startDateTime: null },
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
          { endDate: null, endDateTime: null, startDate: new Date("2022-09-12T00:00:00.000Z"), startDateTime: null },
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
          { endDate: null, endDateTime: null, startDate: new Date("2022-09-12T00:00:00.000Z"), startDateTime: null },
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
          { endDate: null, endDateTime: null, startDate: new Date("2025-09-13T00:00:00.000Z"), startDateTime: null },
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
            description:
              "Valeria Danae Palma Onetto\n17678131-9\n937039005",
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
        { endDate: null, endDateTime: null, startDate: new Date("2026-03-20T00:00:00.000Z"), startDateTime: null },
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
          { endDate: null, endDateTime: null, startDate: new Date("2026-03-20T00:00:00.000Z"), startDateTime: null },
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
          { endDate: null, endDateTime: null, startDate: new Date("2023-01-12T00:00:00.000Z"), startDateTime: null },
          { endDate: null, endDateTime: null, startDate: new Date("2026-02-23T00:00:00.000Z"), startDateTime: null },
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
          { endDate: null, endDateTime: null, startDate: new Date("2026-03-20T00:00:00.000Z"), startDateTime: null },
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
          { endDate: null, endDateTime: null, startDate: new Date("2024-01-01T00:00:00.000Z"), startDateTime: null },
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
