/**
 * Tests for `@/features/services/api` — the recurring-services CRUD +
 * payment-schedule wrappers.
 *
 * High-leverage coverage:
 * - Date fields (`startDate`, `emissionExactDate`, `paidDate`) MUST be
 *   serialised to ISO yyyy-MM-dd strings before reaching the wire — the
 *   backend expects strings, not Date objects. Regression-prone surface.
 * - `Decimal`-like numeric fields returned by the API (objects with
 *   `.toNumber()`) MUST be flattened to JS numbers in
 *   `normalizeDetailResponse` / `normalizeListResponse`. Without this,
 *   the UI tries to render Decimal instances and crashes.
 * - `extractErrorMessage` returns null/string per its contract.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

const orpc = vi.hoisted(() => ({
  create: vi.fn(),
  detail: vi.fn(),
  list: vi.fn(),
  regenerateSchedules: vi.fn(),
  schedulePay: vi.fn(),
  scheduleUnlink: vi.fn(),
  scheduleEdit: vi.fn(),
  scheduleSkip: vi.fn(),
  update: vi.fn(),
  syncAllTransactions: vi.fn(),
  syncTransactions: vi.fn(),
}));

vi.mock("./orpc", () => ({
  servicesORPCClient: orpc,
  toServicesApiError: (e: unknown) => {
    if (e instanceof ApiError) return e;
    if (e instanceof Error) return new ApiError(e.message, 500);
    return new ApiError("unexpected", 500, e);
  },
}));

const {
  createService,
  editServiceSchedule,
  extractErrorMessage,
  fetchServices,
  registerServicePayment,
  syncServiceTransactions,
  updateService,
} = await import("./api");

// Minimal "transport" shapes the normalizers need.
function makeServiceTransport(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    publicId: "svc_123",
    name: "Arriendo",
    serviceType: "OTHER",
    status: "ACTIVE",
    defaultAmount: { toNumber: () => 250_000 }, // Decimal-like
    totalExpected: "500000",
    totalPaid: 100_000,
    lateFeeValue: null,
    ...overrides,
  };
}

function makeScheduleTransport(overrides: Record<string, unknown> = {}) {
  return {
    id: 99,
    serviceId: 1,
    dueDate: new Date("2026-02-01"),
    periodStart: new Date("2026-02-01"),
    periodEnd: new Date("2026-02-28"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-15"),
    expectedAmount: { toNumber: () => 250_000 },
    effectiveAmount: { toNumber: () => 250_000 },
    paidAmount: { toNumber: () => 100_000 },
    paidDate: new Date("2026-02-05"),
    lateFeeAmount: 0,
    overdueDays: 0,
    status: "PARTIAL",
    note: null,
    financialTransactionId: null,
    transactionId: null,
    transaction: null,
    ...overrides,
  };
}

describe("services/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("normalisation", () => {
    it("fetchServices flattens Decimal-like amounts to numbers", async () => {
      orpc.list.mockResolvedValue({ status: "ok", services: [makeServiceTransport()] });
      const { services } = await fetchServices();
      expect(services[0]?.defaultAmount).toBe(250_000);
      // string totals get coerced via Number()
      expect(services[0]?.totalExpected).toBe(500_000);
    });

    it("normalises schedule numeric fields end-to-end", async () => {
      orpc.schedulePay.mockResolvedValue({
        status: "ok",
        schedule: makeScheduleTransport(),
      });
      const result = await registerServicePayment(99, {
        paidAmount: 100_000,
        paidDate: new Date("2026-02-05"),
      } as Parameters<typeof registerServicePayment>[1]);
      expect(result.schedule.expectedAmount).toBe(250_000);
      expect(result.schedule.paidAmount).toBe(100_000);
    });
  });

  describe("payload serialisation (Date → ISO yyyy-MM-dd)", () => {
    it("createService serialises startDate + emissionExactDate", async () => {
      orpc.create.mockResolvedValue({
        status: "ok",
        service: makeServiceTransport(),
        schedules: [],
      });
      await createService({
        name: "Arriendo",
        defaultAmount: 250_000,
        frequency: "MONTHLY",
        serviceType: "OTHER",
        startDate: new Date("2026-03-15T12:00:00Z"),
        emissionExactDate: new Date("2026-03-15T12:00:00Z"),
      } as Parameters<typeof createService>[0]);
      const payload = orpc.create.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(payload.startDate).toBe("2026-03-15");
      expect(payload.emissionExactDate).toBe("2026-03-15");
    });

    it("createService sends null when emissionExactDate is null", async () => {
      orpc.create.mockResolvedValue({
        status: "ok",
        service: makeServiceTransport(),
        schedules: [],
      });
      await createService({
        name: "x",
        defaultAmount: 1,
        frequency: "MONTHLY",
        serviceType: "OTHER",
        startDate: new Date("2026-03-15T12:00:00Z"),
        emissionExactDate: null,
      } as Parameters<typeof createService>[0]);
      const payload = orpc.create.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(payload.emissionExactDate).toBeNull();
    });

    it("updateService wraps payload as { id, payload }", async () => {
      orpc.update.mockResolvedValue({
        status: "ok",
        service: makeServiceTransport(),
        schedules: [],
      });
      await updateService("svc_123", {
        name: "Arriendo (revisado)",
        defaultAmount: 300_000,
        frequency: "MONTHLY",
        serviceType: "OTHER",
        startDate: new Date("2026-03-15T12:00:00Z"),
      } as Parameters<typeof updateService>[1]);
      const call = orpc.update.mock.calls[0]?.[0] as { id: string; payload: { startDate: string } };
      expect(call.id).toBe("svc_123");
      expect(call.payload.startDate).toBe("2026-03-15");
    });

    it("editServiceSchedule serialises optional dueDate", async () => {
      orpc.scheduleEdit.mockResolvedValue({ status: "ok", schedule: makeScheduleTransport() });
      await editServiceSchedule(99, {
        dueDate: new Date("2026-04-01T12:00:00Z"),
        expectedAmount: 1,
      } as Parameters<typeof editServiceSchedule>[1]);
      const call = orpc.scheduleEdit.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(call.id).toBe(99);
      expect(call.dueDate).toBe("2026-04-01");
    });
  });

  describe("error path", () => {
    it("syncServiceTransactions wraps oRPC failures as ApiError", async () => {
      orpc.syncTransactions.mockRejectedValue(new Error("rate-limited"));
      await expect(syncServiceTransactions("svc_x")).rejects.toMatchObject({
        name: "ApiError",
        message: "rate-limited",
      });
    });
  });

  describe("extractErrorMessage", () => {
    it("returns null for falsy inputs", () => {
      expect(extractErrorMessage(null)).toBeNull();
      expect(extractErrorMessage(undefined)).toBeNull();
      expect(extractErrorMessage(0)).toBeNull();
    });

    it("returns the Error.message string for Error instances", () => {
      expect(extractErrorMessage(new Error("boom"))).toBe("boom");
    });

    it("falls back to JSON.stringify for unknown shapes", () => {
      expect(extractErrorMessage({ code: 42 })).toBe('{"code":42}');
    });
  });
});
