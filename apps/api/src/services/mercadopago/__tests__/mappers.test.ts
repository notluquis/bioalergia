import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { mapRowToReleaseTransaction, mapRowToSettlementTransaction } from "../mappers.ts";

describe("mapRowToSettlementTransaction", () => {
  it("maps a complete settlement row", () => {
    const row = {
      SOURCE_ID: "MP-123",
      TRANSACTION_DATE: "2026-05-08T12:00:00Z",
      SETTLEMENT_DATE: "2026-05-09T00:00:00Z",
      EXTERNAL_REFERENCE: "ORDER-1",
      USER_ID: "987",
      PAYMENT_METHOD: "visa",
      PAYMENT_METHOD_TYPE: "credit_card",
      SITE: "MLC",
      TRANSACTION_TYPE: "SETTLEMENT",
      TRANSACTION_AMOUNT: "1000.50",
      TRANSACTION_CURRENCY: "CLP",
      SETTLEMENT_NET_AMOUNT: "950.00",
      SETTLEMENT_CURRENCY: "CLP",
      INSTALLMENTS: "1",
      IS_RELEASED: "true",
      METADATA: '{"foo":"bar"}',
    };
    const out = mapRowToSettlementTransaction(row);
    expect(out.sourceId).toBe("MP-123");
    expect(out.externalReference).toBe("ORDER-1");
    expect(out.transactionType).toBe("SETTLEMENT");
    expect(out.transactionCurrency).toBe("CLP");
    expect((out.transactionAmount as Decimal).toString()).toBe("1000.5");
    expect((out.settlementNetAmount as Decimal).toString()).toBe("950");
    expect(out.installments).toBe(1);
    expect(out.metadata).toEqual({ foo: "bar" });
  });

  it("falls back to CLP when TRANSACTION_CURRENCY is missing", () => {
    const out = mapRowToSettlementTransaction({
      SOURCE_ID: "MP-1",
      TRANSACTION_AMOUNT: "100",
    });
    expect(out.transactionCurrency).toBe("CLP");
  });

  it("returns Unknown transactionType when missing", () => {
    const out = mapRowToSettlementTransaction({ SOURCE_ID: "MP-1" });
    expect(out.transactionType).toBe("Unknown");
  });

  it("nullifies optional string fields when empty", () => {
    const out = mapRowToSettlementTransaction({
      SOURCE_ID: "MP-1",
      EXTERNAL_REFERENCE: "",
      USER_ID: undefined,
    });
    expect(out.externalReference).toBeNull();
    expect(out.userId).toBeNull();
  });

  it("parses comma decimal separators (Spanish locale)", () => {
    const out = mapRowToSettlementTransaction({
      SOURCE_ID: "MP-1",
      TRANSACTION_AMOUNT: "1234,56",
    });
    expect((out.transactionAmount as Decimal).toString()).toBe("1234.56");
  });

  it("returns null for invalid IS_RELEASED on settlement", () => {
    const out = mapRowToSettlementTransaction({
      SOURCE_ID: "MP-1",
      IS_RELEASED: "maybe",
    });
    expect(out.isReleased).toBeNull();
  });

  it("parses bigint shipping/order/pack ids", () => {
    const out = mapRowToSettlementTransaction({
      SOURCE_ID: "MP-1",
      ORDER_ID: "12345678901234",
      SHIPPING_ID: "99999999999999",
      PACK_ID: "11111111111111",
    });
    expect(out.orderId).toBe(12345678901234n);
    expect(out.shippingId).toBe(99999999999999n);
    expect(out.packId).toBe(11111111111111n);
  });
});

describe("mapRowToReleaseTransaction", () => {
  it("maps a complete release row", () => {
    const row = {
      SOURCE_ID: "MP-456",
      DATE: "2026-05-08T10:00:00Z",
      EXTERNAL_REFERENCE: "REL-1",
      RECORD_TYPE: "release",
      DESCRIPTION: "payment",
      NET_CREDIT_AMOUNT: "500",
      NET_DEBIT_AMOUNT: "0",
      GROSS_AMOUNT: "550",
      MP_FEE_AMOUNT: "50",
      INSTALLMENTS: "3",
      PAYMENT_METHOD: "master",
      CURRENCY: "CLP",
      IS_RELEASED: "true",
    };
    const out = mapRowToReleaseTransaction(row);
    expect(out.sourceId).toBe("MP-456");
    expect(out.recordType).toBe("release");
    expect(out.description).toBe("payment");
    expect((out.netCreditAmount as Decimal).toString()).toBe("500");
    expect((out.grossAmount as Decimal).toString()).toBe("550");
    expect(out.installments).toBe(3);
    expect(out.currency).toBe("CLP");
    expect(out.isReleased).toBe(true);
  });

  it("isReleased false when IS_RELEASED='false'", () => {
    const out = mapRowToReleaseTransaction({
      SOURCE_ID: "MP-1",
      IS_RELEASED: "false",
    });
    expect(out.isReleased).toBe(false);
  });

  it("isReleased null when IS_RELEASED missing", () => {
    const out = mapRowToReleaseTransaction({ SOURCE_ID: "MP-1" });
    expect(out.isReleased).toBeNull();
  });

  it("defaults grossAmount to 0 when missing", () => {
    const out = mapRowToReleaseTransaction({ SOURCE_ID: "MP-1" });
    expect((out.grossAmount as Decimal).toString()).toBe("0");
  });

  it("parses TAXES_DISAGGREGATED JSON", () => {
    const out = mapRowToReleaseTransaction({
      SOURCE_ID: "MP-1",
      TAXES_DISAGGREGATED: '[{"name":"IVA","amount":19}]',
    });
    expect(out.taxesDisaggregated).toEqual([{ name: "IVA", amount: 19 }]);
  });

  it("returns undefined for malformed JSON metadata", () => {
    const out = mapRowToReleaseTransaction({
      SOURCE_ID: "MP-1",
      METADATA: "{not json",
    });
    expect(out.metadata).toBeUndefined();
  });
});
