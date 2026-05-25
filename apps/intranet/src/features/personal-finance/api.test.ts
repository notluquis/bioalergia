/**
 * Tests for personal-finance `api.ts` — credit CRUD + installment payment.
 *
 * Golden 2026 patterns: `vi.hoisted` shared mock factory, module-boundary
 * mock of orpc client only, real `toPersonalFinanceApiError` for error
 * mapping. Verifies the transport-normalization layer:
 *
 *   - Decimal-like values (`{ toNumber(): number }`) → plain number
 *   - ISO date strings + Date objects → `YYYY-MM-DD` strings
 *   - Null/undefined passthrough
 *
 * Covers happy + error paths for every mutation (create / pay / delete)
 * plus list/detail reads.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as OrpcModule from "./orpc";

const orpcMocks = vi.hoisted(() => ({
  createCredit: vi.fn(),
  deleteCredit: vi.fn(),
  getCredit: vi.fn(),
  listCredits: vi.fn(),
  payInstallment: vi.fn(),
}));

vi.mock("./orpc", async (importOriginal) => {
  const actual = await importOriginal<typeof OrpcModule>();
  return {
    personalFinanceORPCClient: orpcMocks,
    toPersonalFinanceApiError: actual.toPersonalFinanceApiError,
  };
});

const { personalFinanceApi } = await import("./api");
const { ApiError } = await import("@/lib/api-client");

// Decimal-like helper (Prisma's Decimal exposes `toNumber()`).
function dec(n: number) {
  return { toNumber: () => n };
}

// Minimal valid credit response shape (post normalization).
function makeRawCredit(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    bankName: "Banco Estado",
    creditNumber: "1234-5678",
    currency: "CLP",
    status: "ACTIVE",
    totalAmount: dec(1_200_000),
    totalInstallments: 12,
    startDate: "2026-01-15T00:00:00.000Z",
    interestRate: dec(0.012),
    nextPaymentAmount: dec(100_000),
    nextPaymentDate: new Date("2026-06-01T00:00:00Z"),
    remainingAmount: dec(900_000),
    installments: [
      {
        id: 11,
        creditId: 1,
        installmentNumber: 1,
        amount: dec(100_000),
        capitalAmount: dec(90_000),
        interestAmount: dec(10_000),
        otherCharges: null,
        paidAmount: dec(100_000),
        paidAmountCLP: dec(100_000),
        dueDate: "2026-02-15T00:00:00.000Z",
        paidAt: new Date("2026-02-14T12:00:00Z"),
        status: "PAID",
      },
    ],
    createdAt: new Date("2026-01-15T00:00:00Z"),
    updatedAt: new Date("2026-01-15T00:00:00Z"),
    ...overrides,
  };
}

describe("personal-finance/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listCredits", () => {
    it("forwards no args and normalizes every credit", async () => {
      orpcMocks.listCredits.mockResolvedValue([makeRawCredit(), makeRawCredit({ id: 2 })]);
      const res = await personalFinanceApi.listCredits();
      expect(orpcMocks.listCredits).toHaveBeenCalledWith();
      expect(res).toHaveLength(2);
      expect(res[0]?.totalAmount).toBe(1_200_000);
      expect(typeof res[0]?.totalAmount).toBe("number");
      expect(res[0]?.startDate).toBe("2026-01-15");
      expect(res[0]?.nextPaymentDate).toBe("2026-06-01");
      expect(res[0]?.installments?.[0]?.amount).toBe(100_000);
      expect(res[0]?.installments?.[0]?.dueDate).toBe("2026-02-15");
      expect(res[0]?.installments?.[0]?.paidAt).toBe("2026-02-14");
    });

    it("returns empty array on no credits", async () => {
      orpcMocks.listCredits.mockResolvedValue([]);
      const res = await personalFinanceApi.listCredits();
      expect(res).toEqual([]);
    });

    it("wraps errors as ApiError", async () => {
      orpcMocks.listCredits.mockRejectedValue(new Error("db down"));
      await expect(personalFinanceApi.listCredits()).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("getCredit (detail)", () => {
    it("forwards id and normalizes response", async () => {
      orpcMocks.getCredit.mockResolvedValue(makeRawCredit({ id: 42 }));
      const res = await personalFinanceApi.getCredit(42);
      expect(orpcMocks.getCredit).toHaveBeenCalledWith({ id: 42 });
      expect(res.id).toBe(42);
      expect(res.totalAmount).toBe(1_200_000);
    });

    it("preserves null nextPaymentDate (passthrough, not coerced)", async () => {
      orpcMocks.getCredit.mockResolvedValue(
        makeRawCredit({ nextPaymentDate: null, nextPaymentAmount: null })
      );
      const res = await personalFinanceApi.getCredit(1);
      expect(res.nextPaymentDate).toBeNull();
      expect(res.nextPaymentAmount).toBeNull();
    });

    it("handles already-string date (no 'T' separator) by passing through", async () => {
      orpcMocks.getCredit.mockResolvedValue(makeRawCredit({ startDate: "2026-03-01" }));
      const res = await personalFinanceApi.getCredit(1);
      expect(res.startDate).toBe("2026-03-01");
    });

    it("wraps errors as ApiError", async () => {
      orpcMocks.getCredit.mockRejectedValue(new Error("not found"));
      await expect(personalFinanceApi.getCredit(1)).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("createCredit (budget / new credit)", () => {
    it("forwards full input and normalizes response", async () => {
      orpcMocks.createCredit.mockResolvedValue(makeRawCredit({ id: 7 }));
      const input = {
        bankName: "Banco de Chile",
        creditNumber: "BCH-2026-001",
        currency: "CLP" as const,
        startDate: "2026-05-01",
        totalAmount: 2_400_000,
        totalInstallments: 24,
        interestRate: 0.015,
      };
      const res = await personalFinanceApi.createCredit(input);
      expect(orpcMocks.createCredit).toHaveBeenCalledWith(input);
      expect(res.id).toBe(7);
      expect(typeof res.totalAmount).toBe("number");
    });

    it("wraps errors as ApiError", async () => {
      orpcMocks.createCredit.mockRejectedValue(new Error("duplicate"));
      await expect(
        personalFinanceApi.createCredit({
          bankName: "x",
          creditNumber: "y",
          currency: "CLP",
          startDate: "2026-01-01",
          totalAmount: 1,
          totalInstallments: 1,
        })
      ).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("payInstallment (transaction log entry)", () => {
    it("forwards creditId + installmentNumber + payment data", async () => {
      orpcMocks.payInstallment.mockResolvedValue({
        id: 11,
        creditId: 1,
        installmentNumber: 2,
        amount: dec(105_000),
        capitalAmount: null,
        interestAmount: null,
        otherCharges: null,
        paidAmount: dec(105_000),
        paidAmountCLP: dec(105_000),
        dueDate: "2026-03-15T00:00:00.000Z",
        paidAt: "2026-03-14T12:00:00.000Z",
        status: "PAID",
      });
      const res = await personalFinanceApi.payInstallment(1, 2, {
        amount: 105_000,
        paymentDate: "2026-03-14",
      });
      expect(orpcMocks.payInstallment).toHaveBeenCalledWith({
        amount: 105_000,
        paymentDate: "2026-03-14",
        creditId: 1,
        installmentNumber: 2,
      });
      expect(res.amount).toBe(105_000);
      expect(res.dueDate).toBe("2026-03-15");
      expect(res.paidAt).toBe("2026-03-14");
      expect(res.status).toBe("PAID");
    });

    it("wraps errors as ApiError", async () => {
      orpcMocks.payInstallment.mockRejectedValue(new Error("already paid"));
      await expect(
        personalFinanceApi.payInstallment(1, 2, { amount: 1, paymentDate: "2026-03-14" })
      ).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("deleteCredit", () => {
    it("returns parsed { success: true }", async () => {
      orpcMocks.deleteCredit.mockResolvedValue({ success: true });
      const res = await personalFinanceApi.deleteCredit(9);
      expect(orpcMocks.deleteCredit).toHaveBeenCalledWith({ id: 9 });
      expect(res).toEqual({ success: true });
    });

    it("throws ApiError on schema-invalid response", async () => {
      orpcMocks.deleteCredit.mockResolvedValue({ wrong: "shape" });
      await expect(personalFinanceApi.deleteCredit(9)).rejects.toBeInstanceOf(ApiError);
    });

    it("wraps errors as ApiError", async () => {
      orpcMocks.deleteCredit.mockRejectedValue(new Error("FK violation"));
      await expect(personalFinanceApi.deleteCredit(9)).rejects.toBeInstanceOf(ApiError);
    });
  });
});
