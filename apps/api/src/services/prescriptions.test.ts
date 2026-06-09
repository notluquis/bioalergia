import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    medicalPrescription: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));

import { DomainError } from "../lib/errors.ts";
import { annulPrescription } from "./prescriptions.ts";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("annulPrescription", () => {
  it("throws NOT_FOUND when the prescription is missing", async () => {
    mockDb.medicalPrescription.findUnique.mockResolvedValue(null);
    await expect(annulPrescription("x")).rejects.toMatchObject({ kind: "NOT_FOUND" });
    expect(mockDb.medicalPrescription.update).not.toHaveBeenCalled();
  });

  it("throws CONFLICT when already annulled (idempotent guard)", async () => {
    mockDb.medicalPrescription.findUnique.mockResolvedValue({ id: "x", status: "ANNULLED" });
    await expect(annulPrescription("x")).rejects.toMatchObject({ kind: "CONFLICT" });
    expect(mockDb.medicalPrescription.update).not.toHaveBeenCalled();
  });

  it("sets status=ANNULLED for an issued prescription", async () => {
    mockDb.medicalPrescription.findUnique.mockResolvedValue({ id: "x", status: "ISSUED" });
    mockDb.medicalPrescription.update.mockResolvedValue({ id: "x", status: "ANNULLED" });
    const out = await annulPrescription("x");
    expect(out).toEqual({ id: "x", status: "ANNULLED" });
    expect(mockDb.medicalPrescription.update).toHaveBeenCalledWith({
      where: { id: "x" },
      data: { status: "ANNULLED" },
      select: { id: true, status: true },
    });
  });

  it("propagates DomainError instances", async () => {
    mockDb.medicalPrescription.findUnique.mockResolvedValue(null);
    await expect(annulPrescription("x")).rejects.toBeInstanceOf(DomainError);
  });
});
