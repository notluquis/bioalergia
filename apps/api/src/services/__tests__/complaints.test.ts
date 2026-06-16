import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    complaint: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    foliatedBookEntry: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
    },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { listComplaints, createComplaint, resolveComplaint, listBookEntries, createBookEntry } =
  await import("../complaints.ts");

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.complaint.findMany.mockResolvedValue([]);
  mockDb.complaint.findUnique.mockResolvedValue({ id: "c1" });
  mockDb.complaint.create.mockImplementation(async ({ data }: { data: unknown }) => data);
  mockDb.complaint.update.mockImplementation(async ({ data }: { data: unknown }) => data);
  mockDb.foliatedBookEntry.findMany.mockResolvedValue([]);
  mockDb.foliatedBookEntry.aggregate.mockResolvedValue({ _max: { folio: null } });
  mockDb.foliatedBookEntry.create.mockImplementation(async ({ data }: { data: unknown }) => data);
});

describe("listComplaints", () => {
  it("orders by dueAt asc with no filter when status absent", async () => {
    await listComplaints({});
    expect(mockDb.complaint.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { dueAt: "asc" },
    });
  });

  it("filters by status when provided", async () => {
    await listComplaints({ status: "RECEIVED" });
    expect(mockDb.complaint.findMany).toHaveBeenCalledWith({
      where: { status: "RECEIVED" },
      orderBy: { dueAt: "asc" },
    });
  });
});

describe("createComplaint", () => {
  it("sets status RECEIVED, nullifies optional fields, computes dueAt > now", async () => {
    const before = Date.now();
    const data = (await createComplaint({
      channel: "WEB",
      complainantName: "Juana",
      description: "No me atendieron",
    })) as {
      status: string;
      complainantRut: string | null;
      contact: string | null;
      patientId: number | null;
      category: string | null;
      dueAt: Date;
    };
    expect(data.status).toBe("RECEIVED");
    expect(data.complainantRut).toBeNull();
    expect(data.contact).toBeNull();
    expect(data.patientId).toBeNull();
    expect(data.category).toBeNull();
    // Decreto 35: 15 días hábiles => al menos 21 días corridos (3 fines de semana).
    expect(data.dueAt.getTime()).toBeGreaterThan(before + 20 * 86_400_000);
  });

  it("skips weekends when computing the 15 business-day deadline", async () => {
    // 15 hábiles desde un lunes salta 3 fin-de-semanas => 21 días corridos.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z")); // lunes
    try {
      const data = (await createComplaint({
        channel: "PRESENCIAL",
        complainantName: "Pedro",
        description: "Reclamo",
      })) as { dueAt: Date };
      // 2026-06-01 (lun) + 15 hábiles = 2026-06-22 (lun)
      expect(data.dueAt.getUTCFullYear()).toBe(2026);
      expect(data.dueAt.getUTCMonth()).toBe(5); // junio
      expect(data.dueAt.getUTCDate()).toBe(22);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("resolveComplaint", () => {
  it("throws NOT_FOUND when the complaint does not exist", async () => {
    mockDb.complaint.findUnique.mockResolvedValue(null);
    await expect(resolveComplaint({ id: "nope", status: "RESOLVED" })).rejects.toThrow(
      /no encontrado/
    );
    expect(mockDb.complaint.update).not.toHaveBeenCalled();
  });

  it("sets resolvedAt when RESOLVED", async () => {
    const data = (await resolveComplaint({
      id: "c1",
      status: "RESOLVED",
      resolution: "Resuelto",
    })) as { resolvedAt: Date | null; resolution: string | null; status: string };
    expect(data.status).toBe("RESOLVED");
    expect(data.resolution).toBe("Resuelto");
    expect(data.resolvedAt).toBeInstanceOf(Date);
  });

  it("leaves resolvedAt null for non-RESOLVED transitions", async () => {
    const data = (await resolveComplaint({ id: "c1", status: "IN_PROGRESS" })) as {
      resolvedAt: Date | null;
      resolution: string | null;
    };
    expect(data.resolvedAt).toBeNull();
    expect(data.resolution).toBeNull();
  });
});

describe("listBookEntries", () => {
  it("filters by book and orders by folio desc", async () => {
    await listBookEntries({ book: "COMPLAINTS" });
    expect(mockDb.foliatedBookEntry.findMany).toHaveBeenCalledWith({
      where: { book: "COMPLAINTS" },
      orderBy: { folio: "desc" },
    });
  });
});

describe("createBookEntry", () => {
  it("starts folio at 1 for an empty book and passes createdBy through", async () => {
    const data = (await createBookEntry(
      { book: "PROCEDURES", entryDate: "2026-06-15", summary: "Acta" },
      42
    )) as { folio: number; createdBy: number; entryDate: Date; refType: string | null };
    expect(data.folio).toBe(1);
    expect(data.createdBy).toBe(42);
    expect(data.entryDate).toBeInstanceOf(Date);
    expect(data.refType).toBeNull();
  });

  it("increments folio from the current max", async () => {
    mockDb.foliatedBookEntry.aggregate.mockResolvedValue({ _max: { folio: 7 } });
    const data = (await createBookEntry(
      { book: "INSPECTIONS", entryDate: "2026-06-15", summary: "Inspección" },
      1
    )) as { folio: number };
    expect(data.folio).toBe(8);
  });

  it("maps a unique-violation to CONFLICT", async () => {
    mockDb.foliatedBookEntry.create.mockRejectedValue({ code: "P2002" });
    await expect(
      createBookEntry({ book: "COMPLAINTS", entryDate: "2026-06-15", summary: "x" }, 1)
    ).rejects.toThrow(/Folio en uso/);
  });

  it("rethrows non-unique errors unchanged", async () => {
    mockDb.foliatedBookEntry.create.mockRejectedValue(new Error("boom"));
    await expect(
      createBookEntry({ book: "COMPLAINTS", entryDate: "2026-06-15", summary: "x" }, 1)
    ).rejects.toThrow(/boom/);
  });
});
