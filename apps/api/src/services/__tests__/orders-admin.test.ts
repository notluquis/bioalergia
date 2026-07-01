import { beforeEach, describe, expect, it, vi } from "vitest";

// orders-admin service: the admin refund / cancel / fulfill / edit-address
// transitions with their DomainError guards + best-effort emails. The refund
// path is money-critical: it must fire exactly ONE external MercadoPago refund
// (idempotency guard), fold the DB fixes into one transaction, and on txn
// failure persist REFUNDED best-effort + surface a CONFLICT for reconciliation.
// Mock @finanzas/db (+ slices), the MP refund, reservations, emails, logger —
// no network/db is touched. DomainError is the REAL class (assert kind).

const {
  mockDb,
  mockOrderFindUnique,
  mockOrderUpdate,
  mockPaymentUpdateMany,
  mockTxOrderUpdate,
  mockTxPaymentUpdateMany,
  mockTransaction,
} = vi.hoisted(() => {
  const mockOrderFindUnique = vi.fn();
  const mockOrderUpdate = vi.fn().mockResolvedValue({});
  const mockPaymentUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
  const mockTxOrderUpdate = vi.fn().mockResolvedValue({});
  const mockTxPaymentUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
  // Default: run the callback with a fake tx client (happy path).
  const mockTransaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({
      order: { update: (...a: unknown[]) => mockTxOrderUpdate(...a) },
      payment: { updateMany: (...a: unknown[]) => mockTxPaymentUpdateMany(...a) },
    })
  );
  const mockDb = {
    order: {
      findUnique: (...a: unknown[]) => mockOrderFindUnique(...a),
      update: (...a: unknown[]) => mockOrderUpdate(...a),
    },
    payment: { updateMany: (...a: unknown[]) => mockPaymentUpdateMany(...a) },
    $transaction: (...a: unknown[]) => mockTransaction(...(a as [never])),
    $setOptions: () => mockDb,
  };
  return {
    mockDb,
    mockOrderFindUnique,
    mockOrderUpdate,
    mockPaymentUpdateMany,
    mockTxOrderUpdate,
    mockTxPaymentUpdateMany,
    mockTransaction,
  };
});
vi.mock("@finanzas/db", () => ({ db: mockDb, kysely: {} }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const {
  mockRefundPayment,
  mockReleaseReservations,
  mockRestockTx,
  mockSendDispatched,
  mockSendCancelled,
  mockSendRefund,
  mockLogError,
} = vi.hoisted(() => ({
  mockRefundPayment: vi.fn().mockResolvedValue(undefined),
  mockReleaseReservations: vi.fn().mockResolvedValue(undefined),
  mockRestockTx: vi.fn().mockResolvedValue(undefined),
  mockSendDispatched: vi.fn().mockResolvedValue(undefined),
  mockSendCancelled: vi.fn().mockResolvedValue(undefined),
  mockSendRefund: vi.fn().mockResolvedValue(undefined),
  mockLogError: vi.fn(),
}));
vi.mock("../../modules/mercadopago-checkout/payment.ts", () => ({
  refundPayment: (...a: unknown[]) => mockRefundPayment(...a),
}));
vi.mock("../../modules/reservations/index.ts", () => ({
  releaseReservations: (...a: unknown[]) => mockReleaseReservations(...a),
  restockOrderItemsTx: (...a: unknown[]) => mockRestockTx(...a),
}));
vi.mock("../email/transactional.ts", () => ({
  sendOrderDispatchedEmail: (...a: unknown[]) => mockSendDispatched(...a),
  sendOrderCancelledEmail: (...a: unknown[]) => mockSendCancelled(...a),
  sendOrderRefundEmail: (...a: unknown[]) => mockSendRefund(...a),
}));
vi.mock("../../lib/logger.ts", () => ({
  logError: (...a: unknown[]) => mockLogError(...a),
  logEvent: vi.fn(),
}));

const { DomainError } = await import("../../lib/errors.ts");
const { refundOrder, cancelOrder, markOrderFulfilled, updateOrderShippingAddress } = await import(
  "../orders-admin.ts"
);

// ── Fixtures ────────────────────────────────────────────────────────────────
type Payment = { provider: string; providerPaymentId: string | null; status: string };
function detailRow(over: Record<string, unknown> = {}) {
  return {
    id: 5,
    number: 2001,
    status: "PAID",
    customerName: "Juan",
    customerEmail: "buyer@example.com",
    customerRut: "11.111.111-1",
    customerPhone: "+56 9 1111 1111",
    billingType: "BOLETA",
    totalClp: 25000,
    subtotalClp: 20000,
    shippingClp: 5000,
    shippingAddress: { city: "Santiago", service_code: "3", postal_code: "8320000" },
    cxOtNumber: null,
    cxLabelBase64: null,
    dtePdfUrl: null,
    dteFolio: null,
    dteType: null,
    notes: null,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    items: [
      {
        id: 11,
        productId: 1,
        productSnapshot: { sku: "A", name: "Prod A" },
        qty: 2,
        unitPriceClp: 10000,
        lineTotalClp: 20000,
      },
    ],
    ...over,
  };
}

/**
 * Route db.order.findUnique by its args shape:
 *  - include.payments  → the "existing" row for refund (has `payments`)
 *  - include.items     → getOrderById detail row
 *  - select.status/…   → the guard-row (status, maybe shippingAddress)
 *  - select.accessToken→ the email token row
 */
function routeFindUnique(opts: {
  status?: string;
  payments?: Payment[];
  shippingAddress?: unknown;
  detail?: Record<string, unknown>;
  accessToken?: string;
  missing?: boolean;
}) {
  mockOrderFindUnique.mockImplementation((args: Record<string, unknown>) => {
    if (opts.missing) return Promise.resolve(null);
    const include = args.include as { payments?: boolean; items?: boolean } | undefined;
    const select = args.select as Record<string, boolean> | undefined;
    if (include?.payments) {
      return Promise.resolve(
        detailRow({ status: opts.status ?? "PAID", payments: opts.payments ?? [] })
      );
    }
    if (include?.items) {
      return Promise.resolve(detailRow({ status: opts.status ?? "PAID", ...opts.detail }));
    }
    if (select?.accessToken) {
      return Promise.resolve({ accessToken: opts.accessToken ?? "tok" });
    }
    // guard-row select (status [+ shippingAddress])
    const row: Record<string, unknown> = { status: opts.status ?? "PAID" };
    if (select?.shippingAddress) row.shippingAddress = opts.shippingAddress ?? null;
    return Promise.resolve(row);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOrderUpdate.mockResolvedValue({});
  mockPaymentUpdateMany.mockResolvedValue({ count: 1 });
  mockTxOrderUpdate.mockResolvedValue({});
  mockTxPaymentUpdateMany.mockResolvedValue({ count: 1 });
  mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({
      order: { update: (...a: unknown[]) => mockTxOrderUpdate(...a) },
      payment: { updateMany: (...a: unknown[]) => mockTxPaymentUpdateMany(...a) },
    })
  );
});

// ═══ refundOrder ══════════════════════════════════════════════════════════════

describe("refundOrder — happy path", () => {
  const paidWithMp: Payment[] = [
    { provider: "MERCADO_PAGO", providerPaymentId: "PAY-1", status: "APPROVED" },
  ];

  it("fires exactly ONE MP refund with the providerPaymentId, then runs the DB txn", async () => {
    routeFindUnique({ status: "PAID", payments: paidWithMp });
    const detail = await refundOrder(5);

    expect(mockRefundPayment).toHaveBeenCalledTimes(1);
    expect(mockRefundPayment).toHaveBeenCalledWith("PAY-1");

    // single transaction ran the three DB mutations.
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockRestockTx).toHaveBeenCalledTimes(1);
    expect(mockRestockTx).toHaveBeenCalledWith(expect.anything(), 5);
    expect(mockTxOrderUpdate).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { status: "REFUNDED" },
    });
    expect(mockTxPaymentUpdateMany).toHaveBeenCalledWith({
      where: { orderId: 5 },
      data: { status: "REFUNDED" },
    });

    // detail returned; refund email sent best-effort.
    expect(detail.id).toBe(5);
    expect(detail.number).toBe(2001);
    expect(mockSendRefund).toHaveBeenCalledTimes(1);
    expect(mockSendRefund).toHaveBeenCalledWith({
      to: "buyer@example.com",
      orderNumber: 2001,
      totalClp: 25000,
      accessToken: "tok",
    });
    // best-effort payment.updateMany OUTSIDE the txn is NOT used on success.
    expect(mockPaymentUpdateMany).not.toHaveBeenCalled();
  });

  it("picks the MERCADO_PAGO payment even when another provider row exists first", async () => {
    routeFindUnique({
      status: "PAID",
      payments: [
        { provider: "OTHER", providerPaymentId: "X-9", status: "APPROVED" },
        { provider: "MERCADO_PAGO", providerPaymentId: "PAY-2", status: "APPROVED" },
      ],
    });
    await refundOrder(5);
    expect(mockRefundPayment).toHaveBeenCalledWith("PAY-2");
  });

  it("still returns the detail even if the refund email throws (swallowed)", async () => {
    routeFindUnique({ status: "PAID", payments: paidWithMp });
    mockSendRefund.mockRejectedValueOnce(new Error("smtp"));
    const detail = await refundOrder(5);
    expect(detail.id).toBe(5);
    expect(mockLogError).toHaveBeenCalledWith(
      "orders-admin.refund_email_failed",
      expect.any(Error),
      { orderId: 5 }
    );
  });
});

describe("refundOrder — double-refund guard", () => {
  it("does NOT fire a second MP refund when a payment row is already REFUNDED, but still fixes the DB", async () => {
    routeFindUnique({
      status: "PAID",
      payments: [{ provider: "MERCADO_PAGO", providerPaymentId: "PAY-1", status: "REFUNDED" }],
    });
    await refundOrder(5);

    expect(mockRefundPayment).not.toHaveBeenCalled(); // guard: no double external refund
    // but the DB fix still runs inside the transaction.
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockTxOrderUpdate).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { status: "REFUNDED" },
    });
    expect(mockRestockTx).toHaveBeenCalledTimes(1);
  });
});

describe("refundOrder — txn failure after external refund", () => {
  it("persists REFUNDED best-effort AND rethrows a CONFLICT DomainError", async () => {
    routeFindUnique({
      status: "PAID",
      payments: [{ provider: "MERCADO_PAGO", providerPaymentId: "PAY-1", status: "APPROVED" }],
    });
    mockTransaction.mockRejectedValueOnce(new Error("db down"));

    await expect(refundOrder(5)).rejects.toMatchObject({
      constructor: DomainError,
      kind: "CONFLICT",
    });

    // the external refund DID fire (money is out).
    expect(mockRefundPayment).toHaveBeenCalledTimes(1);
    // best-effort compensating write so a retry's guard sees REFUNDED.
    expect(mockPaymentUpdateMany).toHaveBeenCalledWith({
      where: { orderId: 5 },
      data: { status: "REFUNDED" },
    });
    // CRITICAL log emitted.
    expect(mockLogError).toHaveBeenCalledWith(
      "orders-admin.refund_db_inconsistent",
      expect.any(Error),
      { orderId: 5, severity: "CRITICAL" }
    );
    // no refund email on the failure path.
    expect(mockSendRefund).not.toHaveBeenCalled();
  });

  it("does not mask the CONFLICT even if the best-effort compensating write also fails", async () => {
    routeFindUnique({
      status: "PAID",
      payments: [{ provider: "MERCADO_PAGO", providerPaymentId: "PAY-1", status: "APPROVED" }],
    });
    mockTransaction.mockRejectedValueOnce(new Error("db down"));
    mockPaymentUpdateMany.mockRejectedValueOnce(new Error("still down"));
    const err = await refundOrder(5).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainError);
    expect((err as InstanceType<typeof DomainError>).kind).toBe("CONFLICT");
  });
});

describe("refundOrder — guards", () => {
  it("throws NOT_FOUND when the order does not exist", async () => {
    routeFindUnique({ missing: true });
    await expect(refundOrder(5)).rejects.toMatchObject({ kind: "NOT_FOUND" });
    expect(mockRefundPayment).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST when the order is not PAID (e.g. PENDING)", async () => {
    routeFindUnique({ status: "PENDING", payments: [] });
    await expect(refundOrder(5)).rejects.toMatchObject({ kind: "BAD_REQUEST" });
    expect(mockRefundPayment).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST when there is no MercadoPago payment to refund", async () => {
    routeFindUnique({
      status: "PAID",
      payments: [{ provider: "OTHER", providerPaymentId: "X", status: "APPROVED" }],
    });
    await expect(refundOrder(5)).rejects.toMatchObject({ kind: "BAD_REQUEST" });
    expect(mockRefundPayment).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST when the MP payment row has no providerPaymentId", async () => {
    routeFindUnique({
      status: "PAID",
      payments: [{ provider: "MERCADO_PAGO", providerPaymentId: null, status: "APPROVED" }],
    });
    await expect(refundOrder(5)).rejects.toMatchObject({ kind: "BAD_REQUEST" });
  });
});

// ═══ cancelOrder ══════════════════════════════════════════════════════════════

describe("cancelOrder", () => {
  it("releases reservations then sets CANCELLED for a PENDING order", async () => {
    routeFindUnique({ status: "PENDING" });
    const detail = await cancelOrder(5);

    expect(mockReleaseReservations).toHaveBeenCalledTimes(1);
    expect(mockReleaseReservations).toHaveBeenCalledWith(5);
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { status: "CANCELLED" },
    });
    // getOrderById returns the (detail) row; cancel email best-effort.
    expect(detail.id).toBe(5);
    expect(mockSendCancelled).toHaveBeenCalledTimes(1);
  });

  it("throws BAD_REQUEST and does not release/update a non-PENDING order", async () => {
    routeFindUnique({ status: "PAID" });
    await expect(cancelOrder(5)).rejects.toMatchObject({ kind: "BAD_REQUEST" });
    expect(mockReleaseReservations).not.toHaveBeenCalled();
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND for a missing order", async () => {
    routeFindUnique({ missing: true });
    await expect(cancelOrder(5)).rejects.toMatchObject({ kind: "NOT_FOUND" });
  });

  it("still returns detail when the cancel email throws (swallowed)", async () => {
    routeFindUnique({ status: "PENDING" });
    mockSendCancelled.mockRejectedValueOnce(new Error("smtp"));
    const detail = await cancelOrder(5);
    expect(detail.id).toBe(5);
    expect(mockLogError).toHaveBeenCalledWith(
      "orders-admin.cancel_email_failed",
      expect.any(Error),
      { orderId: 5 }
    );
  });
});

// ═══ markOrderFulfilled ═══════════════════════════════════════════════════════

describe("markOrderFulfilled", () => {
  it("sets FULFILLED for a PAID order and sends the dispatch email", async () => {
    routeFindUnique({ status: "PAID" });
    const detail = await markOrderFulfilled(5);

    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { status: "FULFILLED" },
    });
    expect(detail.id).toBe(5);
    expect(mockSendDispatched).toHaveBeenCalledTimes(1);
    // comuna derived from shipping_address.city; token from accessToken row.
    expect(mockSendDispatched).toHaveBeenCalledWith({
      to: "buyer@example.com",
      orderNumber: 2001,
      shippedToComuna: "Santiago",
      accessToken: "tok",
    });
  });

  it("throws BAD_REQUEST and does not update a non-PAID order", async () => {
    routeFindUnique({ status: "PENDING" });
    await expect(markOrderFulfilled(5)).rejects.toMatchObject({ kind: "BAD_REQUEST" });
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND for a missing order", async () => {
    routeFindUnique({ missing: true });
    await expect(markOrderFulfilled(5)).rejects.toMatchObject({ kind: "NOT_FOUND" });
  });

  it("swallows a dispatch-email failure and still returns the detail", async () => {
    routeFindUnique({ status: "PAID" });
    mockSendDispatched.mockRejectedValueOnce(new Error("smtp"));
    const detail = await markOrderFulfilled(5);
    expect(detail.id).toBe(5);
    expect(mockLogError).toHaveBeenCalledWith(
      "orders-admin.dispatch_email_failed",
      expect.any(Error),
      { orderId: 5 }
    );
  });
});

// ═══ updateOrderShippingAddress ═══════════════════════════════════════════════

describe("updateOrderShippingAddress", () => {
  const newAddr = {
    street: "Nueva Calle",
    street_number: "99",
    city: "Providencia",
    region: "RM",
    county_code: "PROV",
  };

  it("allows a PENDING order and merges, preserving existing postal_code + service_code", async () => {
    routeFindUnique({
      status: "PENDING",
      shippingAddress: {
        street: "Vieja",
        city: "Santiago",
        region: "RM",
        service_code: "3",
        postal_code: "8320000",
      },
    });
    await updateOrderShippingAddress(5, newAddr);

    expect(mockOrderUpdate).toHaveBeenCalledTimes(1);
    const arg = mockOrderUpdate.mock.calls[0][0] as {
      where: { id: number };
      data: { shippingAddress: Record<string, string> };
    };
    const merged = arg.data.shippingAddress;
    // new fields overwrite
    expect(merged.street).toBe("Nueva Calle");
    expect(merged.street_number).toBe("99");
    expect(merged.city).toBe("Providencia");
    expect(merged.region).toBe("RM");
    expect(merged.county_code).toBe("PROV");
    // persisted-only fields survive the merge
    expect(merged.postal_code).toBe("8320000");
    expect(merged.service_code).toBe("3"); // not re-supplied → preserved
  });

  it("allows a PAID (not-yet-dispatched) order", async () => {
    routeFindUnique({ status: "PAID", shippingAddress: {} });
    await updateOrderShippingAddress(5, newAddr);
    expect(mockOrderUpdate).toHaveBeenCalledTimes(1);
  });

  it("lets a re-supplied service_code overwrite the stored one", async () => {
    routeFindUnique({
      status: "PAID",
      shippingAddress: { service_code: "3" },
    });
    await updateOrderShippingAddress(5, { ...newAddr, service_code: "7" });
    const arg = mockOrderUpdate.mock.calls[0][0] as {
      data: { shippingAddress: Record<string, string> };
    };
    expect(arg.data.shippingAddress.service_code).toBe("7");
  });

  it("drops non-string carried entries from the existing JSON (Json rejects them)", async () => {
    routeFindUnique({
      status: "PAID",
      shippingAddress: { postal_code: "8320000", weird: 42, nested: { a: 1 } },
    });
    await updateOrderShippingAddress(5, newAddr);
    const merged = (
      mockOrderUpdate.mock.calls[0][0] as { data: { shippingAddress: Record<string, unknown> } }
    ).data.shippingAddress;
    expect(merged.postal_code).toBe("8320000"); // string kept
    expect(merged.weird).toBeUndefined(); // number dropped
    expect(merged.nested).toBeUndefined(); // object dropped
  });

  it("throws BAD_REQUEST for a FULFILLED order (already handed to courier)", async () => {
    routeFindUnique({ status: "FULFILLED", shippingAddress: {} });
    await expect(updateOrderShippingAddress(5, newAddr)).rejects.toMatchObject({
      kind: "BAD_REQUEST",
    });
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST for a CANCELLED order", async () => {
    routeFindUnique({ status: "CANCELLED", shippingAddress: {} });
    await expect(updateOrderShippingAddress(5, newAddr)).rejects.toMatchObject({
      kind: "BAD_REQUEST",
    });
  });

  it("throws NOT_FOUND for a missing order", async () => {
    routeFindUnique({ missing: true });
    await expect(updateOrderShippingAddress(5, newAddr)).rejects.toMatchObject({
      kind: "NOT_FOUND",
    });
  });

  it("omits an undefined street_number/county_code instead of writing undefined", async () => {
    routeFindUnique({ status: "PENDING", shippingAddress: {} });
    await updateOrderShippingAddress(5, {
      street: "Calle",
      city: "Ciudad",
      region: "RM",
    });
    const merged = (
      mockOrderUpdate.mock.calls[0][0] as { data: { shippingAddress: Record<string, unknown> } }
    ).data.shippingAddress;
    expect("street_number" in merged).toBe(false);
    expect("county_code" in merged).toBe(false);
    expect(merged.street).toBe("Calle");
  });
});
