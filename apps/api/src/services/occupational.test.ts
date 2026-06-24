import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    occupationalProgram: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    occupationalTestBatch: {
      create: vi.fn(),
    },
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));

import { DomainError } from "../lib/errors.ts";
import { attestRiohs, createTestBatch, serializeBatch, setProgramStatus } from "./occupational.ts";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setProgramStatus — gate RIOHS bloqueante", () => {
  it("ACTIVE sin atestación RIOHS → CONFLICT", async () => {
    mockDb.occupationalProgram.findUnique.mockResolvedValueOnce({ id: 1, riohsAttested: false });
    await expect(setProgramStatus(1, "ACTIVE")).rejects.toBeInstanceOf(DomainError);
    expect(mockDb.occupationalProgram.update).not.toHaveBeenCalled();
  });

  it("ACTIVE con atestación RIOHS → procede", async () => {
    mockDb.occupationalProgram.findUnique.mockResolvedValueOnce({ id: 1, riohsAttested: true });
    mockDb.occupationalProgram.update.mockResolvedValueOnce({});
    mockDb.occupationalProgram.findUniqueOrThrow.mockResolvedValueOnce({ id: 1, status: "ACTIVE" });
    await setProgramStatus(1, "ACTIVE");
    expect(mockDb.occupationalProgram.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: "ACTIVE" },
    });
  });

  it("SUSPENDED sin atestación → permitido (no es activación)", async () => {
    mockDb.occupationalProgram.findUnique.mockResolvedValueOnce({ id: 1, riohsAttested: false });
    mockDb.occupationalProgram.update.mockResolvedValueOnce({});
    mockDb.occupationalProgram.findUniqueOrThrow.mockResolvedValueOnce({ id: 1 });
    await setProgramStatus(1, "SUSPENDED");
    expect(mockDb.occupationalProgram.update).toHaveBeenCalled();
  });
});

describe("attestRiohs — rechaza atestación en blanco (Codex P1)", () => {
  it("riohsClauseRef solo espacios → BAD_REQUEST, NO marca atestado", async () => {
    await expect(attestRiohs(1, "   ", 7)).rejects.toBeInstanceOf(DomainError);
    expect(mockDb.occupationalProgram.findUnique).not.toHaveBeenCalled();
    expect(mockDb.occupationalProgram.update).not.toHaveBeenCalled();
  });

  it("referencia válida → guarda trimmed + riohsAttested true", async () => {
    mockDb.occupationalProgram.findUnique.mockResolvedValueOnce({ id: 1 });
    mockDb.occupationalProgram.update.mockResolvedValueOnce({});
    mockDb.occupationalProgram.findUniqueOrThrow.mockResolvedValueOnce({ id: 1 });
    await attestRiohs(1, "  Art. 154 RIOHS  ", 7);
    expect(mockDb.occupationalProgram.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ riohsAttested: true, riohsClauseRef: "Art. 154 RIOHS" }),
    });
  });
});

describe("serializeBatch — supresión por cohorte mínima (k-anonimato)", () => {
  const base = {
    id: 9,
    programId: 1,
    batchDate: new Date("2026-03-01T00:00:00.000Z"),
    notes: null,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
  };

  it("cohorte < 5 → suppressed, conteos Y notas null (Codex P2)", () => {
    const out = serializeBatch({
      ...base,
      notes: "1 presuntivo — Juan P.",
      totalTested: 4,
      passedCount: 4,
      presumptivePositiveCount: 0,
    } as never);
    expect(out.suppressed).toBe(true);
    expect(out.totalTested).toBeNull();
    expect(out.passedCount).toBeNull();
    expect(out.presumptivePositiveCount).toBeNull();
    expect(out.notes).toBeNull();
  });

  it("cohorte ≥ 5 → conteos visibles", () => {
    const out = serializeBatch({
      ...base,
      totalTested: 10,
      passedCount: 9,
      presumptivePositiveCount: 1,
    } as never);
    expect(out.suppressed).toBe(false);
    expect(out.totalTested).toBe(10);
    expect(out.passedCount).toBe(9);
    expect(out.presumptivePositiveCount).toBe(1);
  });
});

describe("createTestBatch — validación de conteos", () => {
  it("passed + presumptive > total → BAD_REQUEST", async () => {
    mockDb.occupationalProgram.findUnique.mockResolvedValueOnce({ id: 1 });
    await expect(
      createTestBatch(
        {
          programId: 1,
          batchDate: new Date("2026-03-01T00:00:00.000Z"),
          totalTested: 5,
          passedCount: 4,
          presumptivePositiveCount: 3,
        },
        null
      )
    ).rejects.toBeInstanceOf(DomainError);
    expect(mockDb.occupationalTestBatch.create).not.toHaveBeenCalled();
  });
});
