import { beforeEach, describe, expect, it, vi } from "vitest";

// restockOrderItemsTx runs the per-item restock loop inside a caller-provided
// `tx` client, so the unit under test never touches the real db — we hand it a
// fake tx. `@finanzas/db` is still imported at module load (the top-level `db`
// + the `txClientProbe` type helper), so mock it minimally so import succeeds.

const { mockDb } = vi.hoisted(() => {
  const mockDb = { $transaction: vi.fn(), $setOptions: () => mockDb };
  return { mockDb };
});
vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { restockOrderItemsTx } = await import("./index.ts");

type TxLike = {
  orderItem: { findMany: ReturnType<typeof vi.fn> };
  product: { update: ReturnType<typeof vi.fn> };
};

function makeTx(items: Array<{ productId: number; qty: number }>): TxLike {
  return {
    orderItem: { findMany: vi.fn().mockResolvedValue(items) },
    product: { update: vi.fn().mockResolvedValue({}) },
  };
}

/** Narrow the fake tx to the real (heavy ZenStack) tx-client param without `any`. */
const asTx = (tx: TxLike): Parameters<typeof restockOrderItemsTx>[0] =>
  tx as unknown as Parameters<typeof restockOrderItemsTx>[0];

describe("restockOrderItemsTx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries only this order's items selecting productId+qty", async () => {
    const tx = makeTx([]);
    await restockOrderItemsTx(asTx(tx), 77);
    expect(tx.orderItem.findMany).toHaveBeenCalledTimes(1);
    expect(tx.orderItem.findMany).toHaveBeenCalledWith({
      where: { orderId: 77 },
      select: { productId: true, qty: true },
    });
  });

  it("increments availableQty by qty and bumps version once per item", async () => {
    const tx = makeTx([
      { productId: 1, qty: 2 },
      { productId: 2, qty: 3 },
    ]);
    await restockOrderItemsTx(asTx(tx), 5);

    expect(tx.product.update).toHaveBeenCalledTimes(2);
    expect(tx.product.update).toHaveBeenNthCalledWith(1, {
      where: { id: 1 },
      data: { availableQty: { increment: 2 }, version: { increment: 1 } },
    });
    expect(tx.product.update).toHaveBeenNthCalledWith(2, {
      where: { id: 2 },
      data: { availableQty: { increment: 3 }, version: { increment: 1 } },
    });
  });

  it("increments by the EXACT per-item qty (not a fixed 1)", async () => {
    const tx = makeTx([{ productId: 9, qty: 7 }]);
    await restockOrderItemsTx(asTx(tx), 1);
    const arg = tx.product.update.mock.calls[0][0] as {
      data: { availableQty: { increment: number } };
    };
    expect(arg.data.availableQty.increment).toBe(7);
  });

  it("makes no product updates when the order has no items", async () => {
    const tx = makeTx([]);
    await restockOrderItemsTx(asTx(tx), 3);
    expect(tx.product.update).not.toHaveBeenCalled();
  });
});
