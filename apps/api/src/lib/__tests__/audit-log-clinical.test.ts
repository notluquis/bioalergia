import { beforeEach, describe, expect, it, vi } from "vitest";

// Behavioral test for the clinical-record access audit emit (Decreto 41/2012
// art. 9). The read handlers (patients.detail/getClinicalSeries/getSkinTests,
// clinical-records.listForPatient, prescription/certificate PDF routes) call
// `logAuditFromContext` with the new CLINICAL_RECORD_READ / CLINICAL_DOCUMENT_VIEW
// kinds. This pins that the emit path accepts those kinds and persists them
// correctly (kind, resource, stringified resourceId, metadata omitted).

const { mockAuditCreate } = vi.hoisted(() => ({
  mockAuditCreate: vi.fn().mockResolvedValue({}),
}));
vi.mock("@finanzas/db", () => ({
  db: { auditLog: { create: (...a: unknown[]) => mockAuditCreate(...a) } },
}));
vi.mock("../client-ip.ts", () => ({ clientIp: () => "203.0.113.7" }));

import { logAuditFromContext } from "../audit-log.ts";

const fakeCtx = {
  req: { header: (n: string) => (n.toLowerCase() === "user-agent" ? "vitest-UA" : undefined) },
} as never;

beforeEach(() => mockAuditCreate.mockClear());

describe("clinical-record access audit", () => {
  it("persists a CLINICAL_RECORD_READ ficha-open with stringified resourceId", async () => {
    await logAuditFromContext(fakeCtx, {
      kind: "CLINICAL_RECORD_READ",
      userId: 7,
      actorLabel: "doc@bioalergia.cl",
      resource: "Patient",
      resourceId: 42,
      message: "ficha:detail",
    });
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const data = mockAuditCreate.mock.calls[0]![0].data;
    expect(data.kind).toBe("CLINICAL_RECORD_READ");
    expect(data.resource).toBe("Patient");
    expect(data.resourceId).toBe("42"); // number coerced to string
    expect(data.userId).toBe(7);
    expect(data.actorLabel).toBe("doc@bioalergia.cl");
    expect(data.ip).toBe("203.0.113.7");
    expect(data.userAgent).toBe("vitest-UA");
    expect(data.message).toBe("ficha:detail");
    // metadata omitted entirely (avoids the chain-verifier json::text mismatch).
    expect("metadata" in data).toBe(false);
  });

  it("persists a CLINICAL_DOCUMENT_VIEW for a served PDF", async () => {
    await logAuditFromContext(fakeCtx, {
      kind: "CLINICAL_DOCUMENT_VIEW",
      userId: 9,
      resource: "MedicalPrescription",
      resourceId: "cuid-abc",
      message: "pdf:served",
    });
    const data = mockAuditCreate.mock.calls[0]![0].data;
    expect(data.kind).toBe("CLINICAL_DOCUMENT_VIEW");
    expect(data.resource).toBe("MedicalPrescription");
    expect(data.resourceId).toBe("cuid-abc");
  });

  it("never throws even if the audit insert fails (fire-and-forget safety)", async () => {
    mockAuditCreate.mockRejectedValueOnce(new Error("db down"));
    await expect(
      logAuditFromContext(fakeCtx, {
        kind: "CLINICAL_RECORD_READ",
        userId: 1,
        resource: "Patient",
        resourceId: 1,
      })
    ).resolves.toBeUndefined();
  });
});
