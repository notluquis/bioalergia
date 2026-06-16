import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    dataRightsRequest: {
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

const { listDataRightsRequests, createDataRightsRequest, resolveDataRightsRequest } =
  await import("../data-rights.ts");

const DAY_MS = 86_400_000;

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.dataRightsRequest.findMany.mockResolvedValue([]);
  mockDb.dataRightsRequest.findUnique.mockResolvedValue({ id: "req_1" });
  mockDb.dataRightsRequest.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: "req_1", ...data })
  );
  mockDb.dataRightsRequest.update.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({ id: "req_1", ...data })
  );
});

describe("listDataRightsRequests", () => {
  it("lists ordered by dueAt asc with no status filter", async () => {
    await listDataRightsRequests({});
    expect(mockDb.dataRightsRequest.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { dueAt: "asc" },
    });
  });

  it("applies the status filter when provided", async () => {
    await listDataRightsRequests({ status: "RECEIVED" });
    expect(mockDb.dataRightsRequest.findMany).toHaveBeenCalledWith({
      where: { status: "RECEIVED" },
      orderBy: { dueAt: "asc" },
    });
  });
});

describe("createDataRightsRequest", () => {
  it("computes dueAt = receivedAt + 30 días corridos and defaults optionals to null", async () => {
    await createDataRightsRequest({
      type: "ACCESS",
      requesterName: "Juana Pérez",
    });
    const call = mockDb.dataRightsRequest.create.mock.calls[0][0];
    const { receivedAt, dueAt } = call.data as { receivedAt: Date; dueAt: Date };
    expect(dueAt.getTime() - receivedAt.getTime()).toBe(30 * DAY_MS);
    expect(call.data.type).toBe("ACCESS");
    expect(call.data.requesterRut).toBeNull();
    expect(call.data.requesterEmail).toBeNull();
    expect(call.data.patientId).toBeNull();
    expect(call.data.notes).toBeNull();
    // status no se setea aquí: lo aporta el @default("RECEIVED") de la BD
    expect(call.data.status).toBeUndefined();
  });

  it("passes through provided optional fields", async () => {
    await createDataRightsRequest({
      type: "DELETION",
      requesterName: "Juan",
      requesterRut: "11.111.111-1",
      requesterEmail: "juan@example.cl",
      patientId: 42,
      notes: "Solicita borrado total",
    });
    const call = mockDb.dataRightsRequest.create.mock.calls[0][0];
    expect(call.data.requesterRut).toBe("11.111.111-1");
    expect(call.data.requesterEmail).toBe("juan@example.cl");
    expect(call.data.patientId).toBe(42);
    expect(call.data.notes).toBe("Solicita borrado total");
  });
});

describe("resolveDataRightsRequest", () => {
  it("throws NOT_FOUND when the request does not exist", async () => {
    mockDb.dataRightsRequest.findUnique.mockResolvedValue(null);
    await expect(resolveDataRightsRequest({ id: "nope", status: "RESOLVED" })).rejects.toThrow(
      /no encontrada/
    );
    expect(mockDb.dataRightsRequest.update).not.toHaveBeenCalled();
  });

  it("seals resolvedAt for RESOLVED (terminal) and records resolution", async () => {
    await resolveDataRightsRequest({
      id: "req_1",
      status: "RESOLVED",
      resolution: "Datos entregados",
    });
    const call = mockDb.dataRightsRequest.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "req_1" });
    expect(call.data.status).toBe("RESOLVED");
    expect(call.data.resolution).toBe("Datos entregados");
    expect(call.data.resolvedAt).toBeInstanceOf(Date);
  });

  it("seals resolvedAt for REJECTED (terminal)", async () => {
    await resolveDataRightsRequest({ id: "req_1", status: "REJECTED" });
    const call = mockDb.dataRightsRequest.update.mock.calls[0][0];
    expect(call.data.status).toBe("REJECTED");
    expect(call.data.resolvedAt).toBeInstanceOf(Date);
    expect(call.data.resolution).toBeNull();
  });

  it("clears resolvedAt when moving back to IN_PROGRESS", async () => {
    await resolveDataRightsRequest({ id: "req_1", status: "IN_PROGRESS" });
    const call = mockDb.dataRightsRequest.update.mock.calls[0][0];
    expect(call.data.status).toBe("IN_PROGRESS");
    expect(call.data.resolvedAt).toBeNull();
  });
});
