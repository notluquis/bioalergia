import { beforeEach, describe, expect, it, vi } from "vitest";

// runOrderPostPayment is the durable post-payment side-effect task: emit DTE,
// create the Chilexpress OT, send the confirmation email, push ML stock. It's
// idempotent by construction (skip when already-done) and distinguishes a
// PERMANENT Chilexpress error (log + continue) from a transient one (rethrow →
// graphile-worker retries). Mock @finanzas/db (+ slices) and every external
// side-effect dep so nothing hits network/db; assert exact call/no-call.

const { mockDb, mockOrderFindUnique, mockOrderUpdate, mockProductFindMany } = vi.hoisted(() => {
  const mockOrderFindUnique = vi.fn();
  const mockOrderUpdate = vi.fn().mockResolvedValue({});
  const mockProductFindMany = vi.fn().mockResolvedValue([]);
  const mockDb = {
    order: {
      findUnique: (...a: unknown[]) => mockOrderFindUnique(...a),
      update: (...a: unknown[]) => mockOrderUpdate(...a),
    },
    product: { findMany: (...a: unknown[]) => mockProductFindMany(...a) },
    $setOptions: () => mockDb,
  };
  return { mockDb, mockOrderFindUnique, mockOrderUpdate, mockProductFindMany };
});
vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const {
  mockEmitDte,
  mockAttachDte,
  mockCreateShipment,
  mockSendConfirmation,
  mockPushStock,
  mockLogError,
  mockLogEvent,
} = vi.hoisted(() => ({
  mockEmitDte: vi.fn(),
  mockAttachDte: vi.fn().mockResolvedValue(undefined),
  mockCreateShipment: vi.fn(),
  mockSendConfirmation: vi.fn().mockResolvedValue(undefined),
  mockPushStock: vi.fn().mockResolvedValue(undefined),
  mockLogError: vi.fn(),
  mockLogEvent: vi.fn(),
}));
vi.mock("../../modules/haulmer/emit-dte.ts", () => ({
  emitDte: (...a: unknown[]) => mockEmitDte(...a),
}));
vi.mock("../../services/orders.ts", () => ({
  attachDteToOrder: (...a: unknown[]) => mockAttachDte(...a),
}));
vi.mock("../../services/shipments.ts", () => ({
  createOrderShipment: (...a: unknown[]) => mockCreateShipment(...a),
}));
vi.mock("../../services/email/transactional.ts", () => ({
  sendOrderConfirmationEmail: (...a: unknown[]) => mockSendConfirmation(...a),
}));
vi.mock("../../modules/mercadolibre/sync.ts", () => ({
  pushStockToMl: (...a: unknown[]) => mockPushStock(...a),
}));
vi.mock("../../lib/logger.ts", () => ({
  logError: (...a: unknown[]) => mockLogError(...a),
  logEvent: (...a: unknown[]) => mockLogEvent(...a),
}));

const { runOrderPostPayment, isPermanentChilexpressError, orderPostPaymentJobKey } = await import(
  "./order-post-payment.ts"
);

type Item = {
  productId: number;
  qty: number;
  unitPriceClp: number;
  productSnapshot: { sku: string; name: string };
};
type Addr = {
  street?: string;
  street_number?: string;
  county_code?: string;
  service_code?: string;
} | null;
type OrderRow = {
  id: number;
  number: number;
  status: string;
  billingType: string;
  customerEmail: string;
  customerRut: string | null;
  customerName: string;
  customerPhone: string | null;
  totalClp: number;
  dteFolio: string | null;
  cxOtNumber: string | null;
  accessToken: string;
  shippingAddress: Addr;
  items: Item[];
};
const fullAddr: Addr = {
  street: "Av Siempre Viva",
  street_number: "742",
  county_code: "STGO",
  service_code: "3",
};
function order(over: Partial<OrderRow> = {}): OrderRow {
  return {
    id: 7,
    number: 1001,
    status: "PAID",
    billingType: "BOLETA",
    customerEmail: "buyer@example.com",
    customerRut: "11.111.111-1",
    customerName: "Juan",
    customerPhone: "+56 9 1234 5678",
    totalClp: 25000,
    dteFolio: null,
    cxOtNumber: null,
    accessToken: "tok",
    shippingAddress: null,
    items: [
      { productId: 1, qty: 2, unitPriceClp: 5000, productSnapshot: { sku: "A", name: "Prod A" } },
    ],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockProductFindMany.mockResolvedValue([]);
});

describe("orderPostPaymentJobKey", () => {
  it("namespaces the job key by orderId", () => {
    expect(orderPostPaymentJobKey(42)).toBe("order_pp_42");
  });
});

describe("isPermanentChilexpressError", () => {
  it("is permanent for the 'no generó la OT' fallback (accented)", () => {
    expect(isPermanentChilexpressError("Chilexpress no generó la OT")).toBe(true);
  });
  it("is permanent for the un-accented 'no genero la OT'", () => {
    expect(isPermanentChilexpressError("no genero la OT")).toBe(true);
  });
  it("is permanent for a friendly 'Chilexpress:' prefixed message", () => {
    expect(isPermanentChilexpressError("Chilexpress: dirección fuera de cobertura")).toBe(true);
  });
  it("trims leading whitespace before the 'chilexpress:' prefix test", () => {
    expect(isPermanentChilexpressError("   chilexpress: bad coverage")).toBe(true);
  });
  it("is TRANSIENT for a 5xx API error (no colon prefix, no OT phrase)", () => {
    expect(isPermanentChilexpressError("ChileExpress API error 500")).toBe(false);
  });
  it("is TRANSIENT for a bare network failure", () => {
    expect(isPermanentChilexpressError("fetch failed")).toBe(false);
  });
});

describe("runOrderPostPayment — idempotency guards", () => {
  it("no-ops (no DTE, no email) when the order is missing", async () => {
    mockOrderFindUnique.mockResolvedValueOnce(null);
    await runOrderPostPayment(999);
    expect(mockEmitDte).not.toHaveBeenCalled();
    expect(mockSendConfirmation).not.toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalledWith(
      "queue.order_post_payment.order_missing",
      expect.any(Error),
      { orderId: 999 }
    );
  });

  it("returns early (no DTE, no email) when the order is not PAID", async () => {
    mockOrderFindUnique.mockResolvedValueOnce(order({ status: "PENDING" }));
    await runOrderPostPayment(7);
    expect(mockEmitDte).not.toHaveBeenCalled();
    expect(mockSendConfirmation).not.toHaveBeenCalled();
    expect(mockLogEvent).toHaveBeenCalledWith("queue.order_post_payment.not_paid", {
      orderId: 7,
      status: "PENDING",
    });
  });

  it("skips emitDte when the order already has a dteFolio", async () => {
    // cxOtNumber set too, so we also skip the OT and land straight on the email.
    mockOrderFindUnique.mockResolvedValueOnce(
      order({ dteFolio: "F-500", cxOtNumber: "OT-1", shippingAddress: fullAddr })
    );
    await runOrderPostPayment(7);
    expect(mockEmitDte).not.toHaveBeenCalled();
    expect(mockAttachDte).not.toHaveBeenCalled();
    // the pre-existing folio still rides along on the confirmation email.
    expect(mockSendConfirmation).toHaveBeenCalledTimes(1);
    const arg = mockSendConfirmation.mock.calls[0][0] as { dteFolio?: string };
    expect(arg.dteFolio).toBe("F-500");
  });

  it("skips createOrderShipment when the order already has a cxOtNumber", async () => {
    mockEmitDte.mockResolvedValueOnce({ folio: "F-1", pdfUrl: "http://pdf" });
    mockOrderFindUnique.mockResolvedValueOnce(
      order({ cxOtNumber: "OT-EXISTING", shippingAddress: fullAddr })
    );
    await runOrderPostPayment(7);
    expect(mockEmitDte).toHaveBeenCalledTimes(1); // dteFolio was null → still emits
    expect(mockCreateShipment).not.toHaveBeenCalled();
    expect(mockSendConfirmation).toHaveBeenCalledTimes(1);
  });

  it("skips the OT when the shipping address is incomplete (no county_code)", async () => {
    mockEmitDte.mockResolvedValueOnce({ folio: "F-1" });
    mockOrderFindUnique.mockResolvedValueOnce(
      order({ shippingAddress: { street: "X", street_number: "1", service_code: "3" } })
    );
    await runOrderPostPayment(7);
    expect(mockCreateShipment).not.toHaveBeenCalled();
    expect(mockProductFindMany).not.toHaveBeenCalled();
  });
});

describe("runOrderPostPayment — full happy path", () => {
  it("emits DTE, creates the OT, persists cx fields, emails, pushes ML stock", async () => {
    mockEmitDte.mockResolvedValueOnce({ folio: "F-777", pdfUrl: "http://pdf/777" });
    mockCreateShipment.mockResolvedValueOnce({
      otNumber: "OT-777",
      barcode: "BC",
      labelBase64: "b64",
      labelType: "PDF",
    });
    mockProductFindMany.mockResolvedValueOnce([
      { id: 1, weightGrams: 500, widthCm: 20, heightCm: 10, lengthCm: 30 },
    ]);
    mockOrderFindUnique.mockResolvedValueOnce(order({ shippingAddress: fullAddr }));

    await runOrderPostPayment(7);

    // DTE emitted with the order's billing + lines mapped from the snapshot.
    expect(mockEmitDte).toHaveBeenCalledTimes(1);
    const dteArg = mockEmitDte.mock.calls[0][0] as {
      documentType: string;
      totalClp: number;
      lines: Array<{ sku: string; name: string; qty: number; unitPriceClp: number }>;
    };
    expect(dteArg.documentType).toBe("BOLETA");
    expect(dteArg.totalClp).toBe(25000);
    expect(dteArg.lines).toEqual([{ sku: "A", name: "Prod A", qty: 2, unitPriceClp: 5000 }]);
    expect(mockAttachDte).toHaveBeenCalledWith(7, { folio: "F-777", pdfUrl: "http://pdf/777" });

    // OT created with real weight (2×500g = 1kg) + dims from the product.
    expect(mockCreateShipment).toHaveBeenCalledTimes(1);
    const otArg = mockCreateShipment.mock.calls[0][0] as {
      orderNumber: number;
      weightKg: number;
      heightCm: number;
      widthCm: number;
      lengthCm: number;
      recipientPhone: string;
    };
    expect(otArg.orderNumber).toBe(1001);
    expect(otArg.weightKg).toBe(1); // 500g × qty 2 = 1000g = 1kg
    expect(otArg.heightCm).toBe(10);
    expect(otArg.widthCm).toBe(20);
    expect(otArg.lengthCm).toBe(30);
    expect(otArg.recipientPhone).toBe("56912345678"); // non-digits stripped

    // cx fields persisted on the order.
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        cxOtNumber: "OT-777",
        cxBarcode: "BC",
        cxLabelBase64: "b64",
        cxLabelType: "PDF",
      },
    });

    // confirmation email carries the fresh folio + pdf.
    const emailArg = mockSendConfirmation.mock.calls[0][0] as {
      dteFolio?: string;
      dtePdfUrl?: string;
    };
    expect(emailArg.dteFolio).toBe("F-777");
    expect(emailArg.dtePdfUrl).toBe("http://pdf/777");

    // ML stock pushed per item.
    expect(mockPushStock).toHaveBeenCalledWith(1);
    expect(mockLogEvent).toHaveBeenCalledWith("queue.order_post_payment.done", { orderId: 7 });
  });

  it("floors weight at 0.3kg when products carry no weight (250g default × 1)", async () => {
    mockEmitDte.mockResolvedValueOnce({ folio: "F-1" });
    mockCreateShipment.mockResolvedValueOnce({
      otNumber: "OT-1",
      barcode: "b",
      labelBase64: "l",
      labelType: "PDF",
    });
    // product row exists but with null weight → 250g default, ×1 = 250g < 300g floor.
    mockProductFindMany.mockResolvedValueOnce([
      { id: 1, weightGrams: null, widthCm: null, heightCm: null, lengthCm: null },
    ]);
    mockOrderFindUnique.mockResolvedValueOnce(
      order({ shippingAddress: fullAddr, items: [{ ...order().items[0], qty: 1 }] })
    );
    await runOrderPostPayment(7);
    const otArg = mockCreateShipment.mock.calls[0][0] as { weightKg: number };
    expect(otArg.weightKg).toBe(0.3); // max(0.3, 0.25)
  });
});

describe("runOrderPostPayment — Chilexpress error policy", () => {
  it("SWALLOWS a permanent OT error and still sends the confirmation email", async () => {
    mockEmitDte.mockResolvedValueOnce({ folio: "F-1" });
    mockProductFindMany.mockResolvedValueOnce([]);
    mockCreateShipment.mockRejectedValueOnce(new Error("Chilexpress: dirección inválida"));
    mockOrderFindUnique.mockResolvedValueOnce(order({ shippingAddress: fullAddr }));

    await expect(runOrderPostPayment(7)).resolves.toBeUndefined();
    // OT never persisted, but the flow continues to the email.
    expect(mockOrderUpdate).not.toHaveBeenCalled();
    expect(mockSendConfirmation).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith(
      "queue.order_post_payment.ot_permanent_failure",
      expect.any(Error),
      { orderId: 7 }
    );
  });

  it("RETHROWS a transient OT error (no email) so graphile-worker retries", async () => {
    mockEmitDte.mockResolvedValueOnce({ folio: "F-1" });
    mockProductFindMany.mockResolvedValueOnce([]);
    mockCreateShipment.mockRejectedValueOnce(new Error("fetch failed"));
    mockOrderFindUnique.mockResolvedValueOnce(order({ shippingAddress: fullAddr }));

    await expect(runOrderPostPayment(7)).rejects.toThrow("fetch failed");
    expect(mockSendConfirmation).not.toHaveBeenCalled();
    expect(mockLogError).not.toHaveBeenCalledWith(
      "queue.order_post_payment.ot_permanent_failure",
      expect.anything(),
      expect.anything()
    );
  });
});
