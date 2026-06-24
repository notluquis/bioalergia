import { beforeEach, describe, expect, it, vi } from "vitest";
import { isDomainError } from "../../lib/errors.ts";

// Characterization tests for the dte-analytics service serialisers + the
// NOT_FOUND DomainError path. The DTE-header lookup and line-items reads are
// now ZenStack ORM (db.dTESaleDetail.findUnique / db.dTELineItem.findMany); the
// linked-events projection stays raw ($queryRaw, 3-join TZ query). All are
// mocked to return canned rows; we assert the Number()/dbDateToISO coercion
// contract the intranet client relies on. (The $qb Kysely builder paths are
// integration-tested elsewhere — too brittle to mock the full fluent chain.)

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    $queryRaw: vi.fn(),
    dTESaleDetail: { findUnique: vi.fn() },
    dTELineItem: { findMany: vi.fn() },
  },
}));

vi.mock("@finanzas/db", () => ({ db: mockDb }));
vi.mock("@finanzas/db/slices", () => ({ dbClinicalSeries: mockDb }));

const { getSalesLinkedEvents, getLineItems } = await import("../dte-analytics.ts");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSalesLinkedEvents", () => {
  it("throws NOT_FOUND DomainError when the DTE row is missing", async () => {
    mockDb.dTESaleDetail.findUnique.mockResolvedValueOnce(null); // findUnique miss
    const err = await getSalesLinkedEvents({ dteSaleDetailId: "abc" }).catch((e: unknown) => e);
    expect(isDomainError(err)).toBe(true);
    expect(err).toMatchObject({ kind: "NOT_FOUND" });
  });

  it("coerces numeric/date fields and returns the linked events list", async () => {
    mockDb.dTESaleDetail.findUnique.mockResolvedValueOnce({
      id: "dte-1",
      documentType: 33,
      saleType: "DEL_GIRO",
      clientRUT: "11111111-1",
      clientName: "ACME",
      folio: "100",
      documentDate: new Date("2026-03-15T00:00:00Z"),
      exemptAmount: 0,
      netAmount: "1000",
      ivaAmount: "190",
      totalAmount: "1190",
      emitterRUT: null,
      referenceDocType: null,
      referenceDocFolio: null,
      _count: { eventLinks: 2, lineItems: 3 },
    });
    mockDb.$queryRaw.mockResolvedValueOnce([
      { calendarId: "cal-1", eventId: "ev-1", summary: "Consulta" },
    ]);

    const res = await getSalesLinkedEvents({ dteSaleDetailId: "dte-1" });

    expect(res.status).toBe("success");
    expect(res.data.dte.documentType).toBe(33);
    expect(res.data.dte.netAmount).toBe(1000);
    expect(res.data.dte.linkedEventsCount).toBe(2);
    expect(res.data.dte.lineItemsCount).toBe(3);
    expect(res.data.dte.documentDate).toBe("2026-03-15");
    expect(res.data.linkedEvents).toHaveLength(1);
    // DTE header now read via ORM findUnique (not raw SQL)
    expect(mockDb.dTESaleDetail.findUnique).toHaveBeenCalledTimes(1);
    expect(mockDb.dTESaleDetail.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "dte-1" } })
    );
    // linked-events projection stays raw
    expect(mockDb.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe("getLineItems", () => {
  it("maps line item rows with numeric coercion + nullable discounts (sale direction)", async () => {
    mockDb.dTELineItem.findMany.mockResolvedValueOnce([
      {
        id: "li-1",
        lineNumber: 1,
        itemName: "Vacuna",
        itemDescription: null,
        quantity: "2",
        unit: "UN",
        unitPrice: "500",
        amount: "1000",
        isExempt: false,
        itemCode: null,
        itemCodeType: null,
        discountPercent: null,
        discountAmount: null,
      },
    ]);

    const res = await getLineItems({ direction: "sale", dteId: "dte-1" });

    expect(res.status).toBe("success");
    expect(res.data).toHaveLength(1);
    expect(res.data[0]).toMatchObject({
      lineNumber: 1,
      quantity: 2,
      unitPrice: 500,
      amount: 1000,
      isExempt: false,
      discountPercent: null,
      discountAmount: null,
    });
    // sale direction → filters on dteSaleDetailId, ordered by lineNumber asc
    expect(mockDb.dTELineItem.findMany).toHaveBeenCalledWith({
      where: { dteSaleDetailId: "dte-1" },
      orderBy: { lineNumber: "asc" },
    });
  });

  it("filters on dtePurchaseDetailId for purchase direction", async () => {
    mockDb.dTELineItem.findMany.mockResolvedValueOnce([]);

    const res = await getLineItems({ direction: "purchase", dteId: "p-9" });

    expect(res.status).toBe("success");
    expect(res.data).toHaveLength(0);
    expect(mockDb.dTELineItem.findMany).toHaveBeenCalledWith({
      where: { dtePurchaseDetailId: "p-9" },
      orderBy: { lineNumber: "asc" },
    });
  });
});
