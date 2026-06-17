import { beforeEach, describe, expect, it, vi } from "vitest";
import { isDomainError } from "../../lib/errors.ts";

// Characterization tests for the exam-reports service (golden 2026 migration):
// DomainError kinds + the Decimal→number / Date→ISO serialisation contract the
// intranet client validates with Zod.

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    examReport: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    clinicSettings: { findUnique: vi.fn() },
    clinicalAllergen: { update: vi.fn() },
  },
}));

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const {
  getExamReport,
  createExamReport,
  listExamReports,
  markExamReportGenerated,
  updateAllergenTags,
} = await import("../exam-reports.ts");

const decimal = (n: number) => ({ toNumber: () => n });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getExamReport", () => {
  it("throws NOT_FOUND when the report is missing", async () => {
    mockDb.examReport.findUnique.mockResolvedValue(null);
    const err = await getExamReport({ id: 5 }).catch((e: unknown) => e);
    expect(isDomainError(err)).toBe(true);
    expect(err).toMatchObject({ kind: "NOT_FOUND" });
  });

  it("serialises Decimal columns to number and dates to ISO", async () => {
    mockDb.examReport.findUnique.mockResolvedValue({
      id: 1,
      histamineMm: decimal(5.5),
      salineMm: null,
      generatedAt: new Date("2026-03-01T10:00:00Z"),
      createdAt: new Date("2026-02-01T10:00:00Z"),
      updatedAt: new Date("2026-02-02T10:00:00Z"),
      patient: { id: 9, birthDate: new Date("1990-01-15T00:00:00Z"), person: {} },
      sections: [{ id: 1, reactions: [{ id: 1, papuleMm: decimal(3.2) }] }],
    });

    const res = await getExamReport({ id: 1 });

    expect(res.histamineMm).toBe(5.5);
    expect(res.salineMm).toBeNull();
    expect(res.generatedAt).toBe("2026-03-01T10:00:00.000Z");
    expect(res.createdAt).toBe("2026-02-01T10:00:00.000Z");
    expect(res.patient.birthDate).toBe("1990-01-15");
    expect(res.sections[0]!.reactions[0]!.papuleMm).toBe(3.2);
  });
});

describe("createExamReport", () => {
  it("throws UNPROCESSABLE_ENTITY when ClinicSettings is not initialised", async () => {
    mockDb.clinicSettings.findUnique.mockResolvedValue(null);
    const err = await createExamReport({
      patientId: 1,
      examType: "SKIN",
      conclusionText: "x",
      sections: [],
    } as never).catch((e: unknown) => e);
    expect(err).toMatchObject({ kind: "UNPROCESSABLE_ENTITY" });
    expect(mockDb.examReport.create).not.toHaveBeenCalled();
  });
});

describe("listExamReports", () => {
  it("builds an insensitive OR search filter and serialises rows", async () => {
    mockDb.examReport.findMany.mockResolvedValue([
      {
        id: 1,
        generatedAt: null,
        createdAt: new Date("2026-02-01T10:00:00Z"),
        updatedAt: new Date("2026-02-02T10:00:00Z"),
      },
    ]);
    mockDb.examReport.count.mockResolvedValue(1);

    const res = await listExamReports({ search: "  acme  " } as never);

    expect(res.total).toBe(1);
    expect(res.items[0]!.generatedAt).toBeNull();
    expect(res.items[0]!.createdAt).toBe("2026-02-01T10:00:00.000Z");
    const whereArg = mockDb.examReport.findMany.mock.calls[0]![0].where;
    expect(Array.isArray(whereArg.OR)).toBe(true);
    expect(whereArg.OR[0].conclusionText.mode).toBe("insensitive");
  });
});

describe("markExamReportGenerated", () => {
  it("stamps generatedAt and returns it as ISO", async () => {
    const when = new Date("2026-04-01T08:00:00Z");
    mockDb.examReport.update.mockResolvedValue({ generatedAt: when });
    const res = await markExamReportGenerated({ id: 1 });
    expect(res.generatedAt).toBe("2026-04-01T08:00:00.000Z");
  });
});

describe("updateAllergenTags", () => {
  it("de-dupes tags and translates P2025 to a NOT_FOUND DomainError", async () => {
    mockDb.clinicalAllergen.update.mockRejectedValue({ code: "P2025" });
    const err = await updateAllergenTags({ id: 1, tags: ["a", "a", "b"] }).catch((e: unknown) => e);
    expect(err).toMatchObject({ kind: "NOT_FOUND" });
    const dataArg = mockDb.clinicalAllergen.update.mock.calls[0]![0].data;
    expect(dataArg.tags).toEqual(["a", "b"]);
  });
});
