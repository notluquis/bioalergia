import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// refreshOrderTrackingIfStale is the lazy on-view Chilexpress tracking refresh.
// It reads db.order.findUnique, calls trackOrders (carrier), and on a delivered
// status flips FULFILLED→DELIVERED + emails the buyer, else just stamps the
// throttle. Mock @finanzas/db (+ slices), the carrier (trackOrders), the email,
// and the logger so no network/db is touched; assert exact branch behavior.

const { mockDb, mockOrderFindUnique, mockOrderUpdate } = vi.hoisted(() => {
  const mockOrderFindUnique = vi.fn();
  const mockOrderUpdate = vi.fn().mockResolvedValue({});
  const mockDb = {
    order: {
      findUnique: (...a: unknown[]) => mockOrderFindUnique(...a),
      update: (...a: unknown[]) => mockOrderUpdate(...a),
    },
    $setOptions: () => mockDb,
  };
  return { mockDb, mockOrderFindUnique, mockOrderUpdate };
});
vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { mockTrackOrders, mockSendDelivered, mockLogError, mockLogEvent } = vi.hoisted(() => ({
  mockTrackOrders: vi.fn(),
  mockSendDelivered: vi.fn().mockResolvedValue(undefined),
  mockLogError: vi.fn(),
  mockLogEvent: vi.fn(),
}));
vi.mock("../shipments.ts", () => ({ trackOrders: (...a: unknown[]) => mockTrackOrders(...a) }));
vi.mock("../email/transactional.ts", () => ({
  sendOrderDeliveredEmail: (...a: unknown[]) => mockSendDelivered(...a),
}));
vi.mock("../../lib/logger.ts", () => ({
  logError: (...a: unknown[]) => mockLogError(...a),
  logEvent: (...a: unknown[]) => mockLogEvent(...a),
}));

const { refreshOrderTrackingIfStale } = await import("../order-tracking.ts");

type OrderRow = {
  id: number;
  number: number;
  status: string;
  cxOtNumber: string | null;
  customerEmail: string;
  accessToken: string;
  trackingCheckedAt: Date | null;
};
function order(over: Partial<OrderRow> = {}): OrderRow {
  return {
    id: 42,
    number: 123,
    status: "FULFILLED",
    cxOtNumber: "OT-9",
    customerEmail: "buyer@example.com",
    accessToken: "tok",
    trackingCheckedAt: null,
    ...over,
  };
}
/** trackOrders resolves a Map keyed `BIO-ORD-<number>`. */
const trackMap = (num: number, status: string) => new Map([[`BIO-ORD-${num}`, status]]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-01T12:00:00.000Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("refreshOrderTrackingIfStale — skip guards", () => {
  it("does nothing when the order does not exist", async () => {
    mockOrderFindUnique.mockResolvedValueOnce(null);
    await refreshOrderTrackingIfStale(1);
    expect(mockTrackOrders).not.toHaveBeenCalled();
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  it("skips when the order is not FULFILLED (e.g. still PAID)", async () => {
    mockOrderFindUnique.mockResolvedValueOnce(order({ status: "PAID" }));
    await refreshOrderTrackingIfStale(42);
    expect(mockTrackOrders).not.toHaveBeenCalled();
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  it("skips when there is no cxOtNumber to look up", async () => {
    mockOrderFindUnique.mockResolvedValueOnce(order({ cxOtNumber: null }));
    await refreshOrderTrackingIfStale(42);
    expect(mockTrackOrders).not.toHaveBeenCalled();
  });

  it("throttles when trackingCheckedAt is within the 15-min window", async () => {
    // checked 14 min ago → inside the 15-min throttle → skip the carrier.
    mockOrderFindUnique.mockResolvedValueOnce(
      order({ trackingCheckedAt: new Date("2026-07-01T11:46:00.000Z") })
    );
    await refreshOrderTrackingIfStale(42);
    expect(mockTrackOrders).not.toHaveBeenCalled();
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  it("does NOT throttle when the last check is exactly 15 min ago (boundary)", async () => {
    // 15 min ago → elapsed === window → `< window` is false → proceeds.
    mockOrderFindUnique.mockResolvedValueOnce(
      order({ trackingCheckedAt: new Date("2026-07-01T11:45:00.000Z") })
    );
    mockTrackOrders.mockResolvedValueOnce(trackMap(123, "En tránsito"));
    await refreshOrderTrackingIfStale(42);
    expect(mockTrackOrders).toHaveBeenCalledTimes(1);
  });
});

describe("refreshOrderTrackingIfStale — carrier query", () => {
  it("calls trackOrders once with the order's number + OT", async () => {
    mockOrderFindUnique.mockResolvedValueOnce(order());
    mockTrackOrders.mockResolvedValueOnce(trackMap(123, "En tránsito"));
    await refreshOrderTrackingIfStale(42);
    expect(mockTrackOrders).toHaveBeenCalledTimes(1);
    expect(mockTrackOrders).toHaveBeenCalledWith([{ number: 123, cxOtNumber: "OT-9" }]);
  });

  it("reads the order with the exact select shape", async () => {
    mockOrderFindUnique.mockResolvedValueOnce(order({ status: "PAID" }));
    await refreshOrderTrackingIfStale(42);
    expect(mockOrderFindUnique).toHaveBeenCalledWith({
      where: { id: 42 },
      select: {
        id: true,
        number: true,
        status: true,
        cxOtNumber: true,
        customerEmail: true,
        accessToken: true,
        trackingCheckedAt: true,
      },
    });
  });
});

describe("refreshOrderTrackingIfStale — delivered transition", () => {
  it("flips FULFILLED→DELIVERED, stamps trackingCheckedAt, and emails the buyer", async () => {
    mockOrderFindUnique.mockResolvedValueOnce(order());
    mockTrackOrders.mockResolvedValueOnce(trackMap(123, "Entregado"));
    await refreshOrderTrackingIfStale(42);

    expect(mockOrderUpdate).toHaveBeenCalledTimes(1);
    const arg = mockOrderUpdate.mock.calls[0][0] as {
      where: { id: number };
      data: { status?: string; trackingCheckedAt: Date };
    };
    expect(arg.where).toEqual({ id: 42 });
    expect(arg.data.status).toBe("DELIVERED");
    expect(arg.data.trackingCheckedAt).toEqual(new Date("2026-07-01T12:00:00.000Z"));

    expect(mockSendDelivered).toHaveBeenCalledTimes(1);
    expect(mockSendDelivered).toHaveBeenCalledWith({
      to: "buyer@example.com",
      orderNumber: 123,
      accessToken: "tok",
    });
    expect(mockLogEvent).toHaveBeenCalledWith("order_tracking.refresh.done", {
      orderId: 42,
      delivered: true,
    });
  });

  it("matches the delivered heuristic case-insensitively (ENTREGADO)", async () => {
    mockOrderFindUnique.mockResolvedValueOnce(order());
    mockTrackOrders.mockResolvedValueOnce(trackMap(123, "ENTREGADO AL CLIENTE"));
    await refreshOrderTrackingIfStale(42);
    const arg = mockOrderUpdate.mock.calls[0][0] as { data: { status?: string } };
    expect(arg.data.status).toBe("DELIVERED");
  });

  it("keeps the DELIVERED transition even if the delivered email throws", async () => {
    mockOrderFindUnique.mockResolvedValueOnce(order());
    mockTrackOrders.mockResolvedValueOnce(trackMap(123, "Entregado"));
    mockSendDelivered.mockRejectedValueOnce(new Error("smtp down"));
    await expect(refreshOrderTrackingIfStale(42)).resolves.toBeUndefined();
    // the DELIVERED update still happened; only the email failed (swallowed).
    const arg = mockOrderUpdate.mock.calls[0][0] as { data: { status?: string } };
    expect(arg.data.status).toBe("DELIVERED");
    expect(mockLogError).toHaveBeenCalledWith(
      "order_tracking.refresh.email_failed",
      expect.any(Error),
      { orderId: 42 }
    );
  });
});

describe("refreshOrderTrackingIfStale — non-delivered", () => {
  it("stamps only trackingCheckedAt (no status change, no email) when in transit", async () => {
    mockOrderFindUnique.mockResolvedValueOnce(order());
    mockTrackOrders.mockResolvedValueOnce(trackMap(123, "En tránsito"));
    await refreshOrderTrackingIfStale(42);

    expect(mockOrderUpdate).toHaveBeenCalledTimes(1);
    const arg = mockOrderUpdate.mock.calls[0][0] as {
      where: { id: number };
      data: { status?: string; trackingCheckedAt: Date };
    };
    expect(arg.data.status).toBeUndefined();
    expect(arg.data.trackingCheckedAt).toEqual(new Date("2026-07-01T12:00:00.000Z"));
    expect(mockSendDelivered).not.toHaveBeenCalled();
    expect(mockLogEvent).toHaveBeenCalledWith("order_tracking.refresh.done", {
      orderId: 42,
      delivered: false,
    });
  });

  it("treats an unknown/undefined carrier status as non-delivered (stamp only)", async () => {
    mockOrderFindUnique.mockResolvedValueOnce(order());
    // Map has no BIO-ORD-123 key → status undefined → not delivered.
    mockTrackOrders.mockResolvedValueOnce(new Map());
    await refreshOrderTrackingIfStale(42);
    const arg = mockOrderUpdate.mock.calls[0][0] as { data: { status?: string } };
    expect(arg.data.status).toBeUndefined();
    expect(mockSendDelivered).not.toHaveBeenCalled();
  });
});

describe("refreshOrderTrackingIfStale — carrier error", () => {
  it("swallows a carrier error and does NOT stamp trackingCheckedAt (retry next view)", async () => {
    mockOrderFindUnique.mockResolvedValueOnce(order());
    mockTrackOrders.mockRejectedValueOnce(new Error("carrier 503"));
    await expect(refreshOrderTrackingIfStale(42)).resolves.toBeUndefined();
    // no update at all → next view will retry (throttle not advanced).
    expect(mockOrderUpdate).not.toHaveBeenCalled();
    expect(mockSendDelivered).not.toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalledWith(
      "order_tracking.refresh.track_failed",
      expect.any(Error),
      { orderId: 42 }
    );
  });
});
