import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    processingActivity: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { listProcessingActivities, upsertProcessingActivity, deleteProcessingActivity } =
  await import("../processing-activities.ts");

const BASE = {
  name: "Gestión de fichas clínicas",
  purpose: "Atención de salud",
  legalBasis: "HEALTH_CARE" as const,
  dataCategories: "Identificación, salud",
  dataSubjects: "Pacientes",
  internationalTransfer: false,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.processingActivity.findMany.mockResolvedValue([]);
  mockDb.processingActivity.findUnique.mockResolvedValue({ id: "act_1" });
  mockDb.processingActivity.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: "act_1", ...data })
  );
  mockDb.processingActivity.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: "act_1", ...data })
  );
  mockDb.processingActivity.delete.mockResolvedValue({});
});

describe("listProcessingActivities", () => {
  it("lists active-first then by name", async () => {
    await listProcessingActivities();
    expect(mockDb.processingActivity.findMany).toHaveBeenCalledWith({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
  });
});

describe("upsertProcessingActivity", () => {
  it("creates when no id; defaults optional fields to null", async () => {
    await upsertProcessingActivity({ ...BASE });
    expect(mockDb.processingActivity.create).toHaveBeenCalledTimes(1);
    const call = mockDb.processingActivity.create.mock.calls[0][0];
    expect(call.data.recipients).toBeNull();
    expect(call.data.retentionPeriod).toBeNull();
    expect(call.data.securityMeasures).toBeNull();
    expect(call.data.notes).toBeNull();
    expect(call.data.legalBasis).toBe("HEALTH_CARE");
  });

  it("updates when id present", async () => {
    await upsertProcessingActivity({ ...BASE, id: "act_1", name: "Actualizada" });
    expect(mockDb.processingActivity.update).toHaveBeenCalledWith({
      where: { id: "act_1" },
      data: expect.objectContaining({ name: "Actualizada" }),
    });
  });

  it("throws NOT_FOUND updating a missing id", async () => {
    mockDb.processingActivity.findUnique.mockResolvedValue(null);
    await expect(upsertProcessingActivity({ ...BASE, id: "nope" })).rejects.toThrow(
      /no encontrada/
    );
    expect(mockDb.processingActivity.update).not.toHaveBeenCalled();
  });
});

describe("deleteProcessingActivity", () => {
  it("throws NOT_FOUND when missing", async () => {
    mockDb.processingActivity.findUnique.mockResolvedValue(null);
    await expect(deleteProcessingActivity("nope")).rejects.toThrow(/no encontrada/);
    expect(mockDb.processingActivity.delete).not.toHaveBeenCalled();
  });

  it("deletes when present", async () => {
    const r = await deleteProcessingActivity("act_1");
    expect(r).toEqual({ status: "ok" });
    expect(mockDb.processingActivity.delete).toHaveBeenCalledWith({ where: { id: "act_1" } });
  });
});
