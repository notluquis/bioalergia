import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    breachIncident: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { listBreachIncidents, createBreachIncident, updateBreachIncident } =
  await import("../breach-incidents.ts");

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.breachIncident.findMany.mockResolvedValue([]);
  mockDb.breachIncident.findUnique.mockResolvedValue({ id: "inc_1" });
  mockDb.breachIncident.create.mockResolvedValue({ id: "inc_1" });
  mockDb.breachIncident.update.mockResolvedValue({ id: "inc_1" });
});

describe("listBreachIncidents", () => {
  it("orders by detectedAt desc and omits where when no status", async () => {
    await listBreachIncidents({});
    expect(mockDb.breachIncident.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { detectedAt: "desc" },
    });
  });

  it("filters by status when provided", async () => {
    await listBreachIncidents({ status: "DETECTED" });
    expect(mockDb.breachIncident.findMany).toHaveBeenCalledWith({
      where: { status: "DETECTED" },
      orderBy: { detectedAt: "desc" },
    });
  });
});

describe("createBreachIncident", () => {
  it("coerces detectedAt to a Date and defaults nullable fields", async () => {
    await createBreachIncident({
      detectedAt: "2026-06-10T12:00:00.000Z",
      description: "Acceso no autorizado a la base",
      severity: "HIGH",
    });
    const call = mockDb.breachIncident.create.mock.calls[0][0];
    expect(call.data.detectedAt).toBeInstanceOf(Date);
    expect(call.data.detectedAt.toISOString()).toBe("2026-06-10T12:00:00.000Z");
    expect(call.data.severity).toBe("HIGH");
    expect(call.data.affectedData).toBeNull();
    expect(call.data.affectedCount).toBeNull();
  });

  it("passes through affectedData and affectedCount when provided", async () => {
    await createBreachIncident({
      detectedAt: "2026-06-10",
      description: "Fuga parcial",
      severity: "MEDIUM",
      affectedData: "RUT, correos",
      affectedCount: 42,
    });
    const call = mockDb.breachIncident.create.mock.calls[0][0];
    expect(call.data.affectedData).toBe("RUT, correos");
    expect(call.data.affectedCount).toBe(42);
  });

  it("throws BAD_REQUEST when detectedAt is invalid", async () => {
    await expect(
      createBreachIncident({
        detectedAt: "not-a-date",
        description: "x",
        severity: "LOW",
      })
    ).rejects.toThrow(/Fecha de detección inválida/);
    expect(mockDb.breachIncident.create).not.toHaveBeenCalled();
  });
});

describe("updateBreachIncident", () => {
  it("throws NOT_FOUND when the incident does not exist", async () => {
    mockDb.breachIncident.findUnique.mockResolvedValue(null);
    await expect(updateBreachIncident({ id: "nope", status: "CLOSED" })).rejects.toThrow(
      /no encontrado/
    );
    expect(mockDb.breachIncident.update).not.toHaveBeenCalled();
  });

  it("updates only provided fields and coerces date strings to Date", async () => {
    await updateBreachIncident({
      id: "inc_1",
      status: "NOTIFIED",
      agencyNotifiedAt: "2026-06-11T09:00:00.000Z",
      notes: "Notificado a la Agencia",
    });
    const call = mockDb.breachIncident.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "inc_1" });
    expect(call.data.status).toBe("NOTIFIED");
    expect(call.data.agencyNotifiedAt).toBeInstanceOf(Date);
    expect(call.data.notes).toBe("Notificado a la Agencia");
    expect("subjectsNotifiedAt" in call.data).toBe(false);
  });

  it("allows clearing a date field with null", async () => {
    await updateBreachIncident({ id: "inc_1", subjectsNotifiedAt: null });
    const call = mockDb.breachIncident.update.mock.calls[0][0];
    expect(call.data.subjectsNotifiedAt).toBeNull();
  });

  it("throws BAD_REQUEST when a date string is invalid", async () => {
    await expect(
      updateBreachIncident({ id: "inc_1", agencyNotifiedAt: "garbage" })
    ).rejects.toThrow(/Agencia inválida/);
    expect(mockDb.breachIncident.update).not.toHaveBeenCalled();
  });
});
