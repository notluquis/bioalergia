import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
  const mk = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  });
  const mockDb = {
    occTestSubject: mk(),
    occTestOrder: mk(),
    occCustodyEvent: mk(),
    occSample: mk(),
    occScreeningResult: mk(),
    occConfirmatoryResult: mk(),
    occMedicalReview: mk(),
    occConsent: mk(),
    occDisclosure: mk(),
    occupationalProgram: mk(),
  };
  return { mockDb };
});

vi.mock("@finanzas/db", () => ({ db: mockDb }));

import { DomainError } from "../lib/errors.ts";
import {
  createOrder,
  discloseToEmployer,
  recordConfirmatory,
  recordMedicalReview,
  recordScreening,
} from "./occupational-testing.ts";

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.occTestOrder.update.mockResolvedValue({});
});

describe("createOrder — gate RIOHS heredado del programa", () => {
  it("programa sin atestación RIOHS → CONFLICT", async () => {
    mockDb.occTestSubject.findUnique.mockResolvedValueOnce({ id: 1 });
    mockDb.occupationalProgram.findUnique.mockResolvedValueOnce({ id: 5, riohsAttested: false });
    await expect(
      createOrder(
        {
          subjectId: 1,
          programId: 5,
          testingReason: "PERIODICO",
          requestSource: "SOLICITUD_EMPLEADOR",
          regulatoryBasis: "RIOHS",
          mandateType: "PERMITTED_VIA_RIOHS",
        },
        9
      )
    ).rejects.toBeInstanceOf(DomainError);
    expect(mockDb.occTestOrder.create).not.toHaveBeenCalled();
  });
});

describe("G1 — sin positivo sin confirmatorio", () => {
  it("recordConfirmatory sin tamizaje presuntivo → BAD_REQUEST", async () => {
    mockDb.occTestOrder.findUnique.mockResolvedValueOnce({
      id: 1,
      screening: { outcome: "NEGATIVE" },
      confirmatory: null,
    });
    await expect(
      recordConfirmatory({
        orderId: 1,
        method: "GC_MS",
        sampleId: 10,
        analytes: [],
        outcome: "POSITIVE",
      })
    ).rejects.toBeInstanceOf(DomainError);
    expect(mockDb.occConfirmatoryResult.create).not.toHaveBeenCalled();
  });

  it("recordMedicalReview sin confirmatorio POSITIVE → BAD_REQUEST", async () => {
    mockDb.occTestOrder.findUnique.mockResolvedValueOnce({
      id: 1,
      confirmatory: { outcome: "NEGATIVE" },
      medicalReview: null,
    });
    await expect(
      recordMedicalReview({ orderId: 1, decision: "CONFIRMED_POSITIVE", rationale: "x" }, 9)
    ).rejects.toBeInstanceOf(DomainError);
    expect(mockDb.occMedicalReview.create).not.toHaveBeenCalled();
  });

  it("tamizaje NEGATIVE → resultado final NEGATIVE, RESULTED", async () => {
    mockDb.occTestOrder.findUnique.mockResolvedValueOnce({ id: 1, screening: null });
    mockDb.occScreeningResult.create.mockResolvedValueOnce({ id: 1 });
    await recordScreening({ orderId: 1, panel: [], outcome: "NEGATIVE" });
    expect(mockDb.occTestOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ status: "RESULTED", finalResult: "NEGATIVE" }),
      })
    );
  });
});

describe("G3 — confirmatorio sobre el mismo espécimen", () => {
  it("muestra de otra orden → BAD_REQUEST", async () => {
    mockDb.occTestOrder.findUnique.mockResolvedValueOnce({
      id: 1,
      screening: { outcome: "PRESUMPTIVE_POSITIVE" },
      confirmatory: null,
    });
    mockDb.occSample.findUnique.mockResolvedValueOnce({ id: 10, orderId: 999 }); // distinta orden
    await expect(
      recordConfirmatory({
        orderId: 1,
        method: "GC_MS",
        sampleId: 10,
        analytes: [],
        outcome: "POSITIVE",
      })
    ).rejects.toBeInstanceOf(DomainError);
    expect(mockDb.occConfirmatoryResult.create).not.toHaveBeenCalled();
  });

  it("positivo confirmado sobre muestra propia → pasa a MEDICAL_REVIEW", async () => {
    mockDb.occTestOrder.findUnique.mockResolvedValueOnce({
      id: 1,
      screening: { outcome: "PRESUMPTIVE_POSITIVE" },
      confirmatory: null,
    });
    mockDb.occSample.findUnique.mockResolvedValueOnce({ id: 10, orderId: 1 });
    mockDb.occConfirmatoryResult.create.mockResolvedValueOnce({ id: 1 });
    await recordConfirmatory({
      orderId: 1,
      method: "LC_MS_MS",
      sampleId: 10,
      analytes: [],
      outcome: "POSITIVE",
    });
    expect(mockDb.occTestOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "MEDICAL_REVIEW" }) })
    );
  });
});

describe("G2 — divulgación al empleador consent-gated", () => {
  it("AGGREGATE → siempre permitido (sin consent)", async () => {
    mockDb.occTestOrder.findUnique.mockResolvedValueOnce({ id: 1 });
    mockDb.occDisclosure.create.mockResolvedValueOnce({ id: 1 });
    await discloseToEmployer({ orderId: 1, payloadKind: "AGGREGATE" }, 9);
    expect(mockDb.occDisclosure.create).toHaveBeenCalled();
  });

  it("FITNESS_OUTCOME sin consent EMPLOYER_DISCLOSURE → FORBIDDEN", async () => {
    mockDb.occTestOrder.findUnique.mockResolvedValueOnce({ id: 1 });
    mockDb.occConsent.findFirst.mockResolvedValueOnce(null); // sin consent vivo
    await expect(
      discloseToEmployer({ orderId: 1, payloadKind: "FITNESS_OUTCOME" }, 9)
    ).rejects.toBeInstanceOf(DomainError);
    expect(mockDb.occDisclosure.create).not.toHaveBeenCalled();
  });

  it("SUBSTANCE_DETAIL con EMPLOYER_DISCLOSURE pero sin SUBSTANCE_LEVEL → FORBIDDEN", async () => {
    mockDb.occTestOrder.findUnique.mockResolvedValueOnce({ id: 1 });
    // 1ª llamada (EMPLOYER_DISCLOSURE) → vivo; 2ª (SUBSTANCE_LEVEL) → null
    mockDb.occConsent.findFirst
      .mockResolvedValueOnce({ id: 7, granted: true })
      .mockResolvedValueOnce(null);
    await expect(
      discloseToEmployer({ orderId: 1, payloadKind: "SUBSTANCE_DETAIL" }, 9)
    ).rejects.toBeInstanceOf(DomainError);
    expect(mockDb.occDisclosure.create).not.toHaveBeenCalled();
  });
});
