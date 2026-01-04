import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { prisma } from "../server/prisma";
import { createSupplyRequest, getSupplyRequests, updateSupplyRequestStatus } from "../server/services/supplies";

// Mock prisma
vi.mock("../server/prisma", () => ({
  prisma: {
    supplyRequest: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("Supplies Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a supply request", async () => {
    const mockData = {
      userId: 1,
      supplyName: "Test Supply",
      quantity: 10,
    };

    (prisma.supplyRequest.create as Mock).mockResolvedValue({
      id: 1,
      ...mockData,
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await createSupplyRequest(mockData);

    expect(prisma.supplyRequest.create).toHaveBeenCalledWith({
      data: {
        ...mockData,
        status: "PENDING",
        brand: undefined,
        model: undefined,
        notes: undefined,
      },
    });
    expect(result.supplyName).toBe("Test Supply");
  });

  it("should list supply requests", async () => {
    const mockRequests = [
      { id: 1, supplyName: "A", quantity: 1 },
      { id: 2, supplyName: "B", quantity: 2 },
    ];
    (prisma.supplyRequest.findMany as Mock).mockResolvedValue(mockRequests);

    const result = await getSupplyRequests();

    expect(prisma.supplyRequest.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            email: true,
            person: {
              select: {
                names: true,
                fatherName: true,
              },
            },
          },
        },
      },
    });
    expect(result).toHaveLength(2);
  });

  it("should update supply request status", async () => {
    const mockId = 1;
    const newStatus = "APPROVED";

    (prisma.supplyRequest.update as Mock).mockResolvedValue({
      id: mockId,
      status: newStatus,
    });

    await updateSupplyRequestStatus(mockId, newStatus);

    expect(prisma.supplyRequest.update).toHaveBeenCalledWith({
      where: { id: mockId },
      data: { status: newStatus },
    });
  });
});
