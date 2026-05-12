import { describe, expect, it } from "vitest";
import { mapTransaction } from "../mappers.ts";

const BASE_ROW = {
  id: 1,
  transactionDate: new Date("2026-01-15"),
  description: "Pago consulta",
  transactionType: "credit",
  transactionAmount: 45000,
  status: "completed",
  externalReference: "REF-001",
  sourceId: "src-123",
  paymentMethod: "transfer",
  settlementNetAmount: 44100,
};

describe("mapTransaction", () => {
  it("maps all fields correctly", () => {
    const result = mapTransaction(BASE_ROW);
    expect(result.id).toBe(1);
    expect(result.transactionDate).toEqual(new Date("2026-01-15"));
    expect(result.description).toBe("Pago consulta");
    expect(result.transactionType).toBe("credit");
    expect(result.transactionAmount).toBe(45000);
    expect(result.status).toBe("completed");
    expect(result.externalReference).toBe("REF-001");
    expect(result.sourceId).toBe("src-123");
    expect(result.paymentMethod).toBe("transfer");
    expect(result.settlementNetAmount).toBe(44100);
  });

  it("converts numeric id to Number", () => {
    const result = mapTransaction({ ...BASE_ROW, id: "99" as unknown as number });
    expect(result.id).toBe(99);
    expect(typeof result.id).toBe("number");
  });

  it("passes null amounts through as null", () => {
    const result = mapTransaction({
      ...BASE_ROW,
      transactionAmount: null,
      settlementNetAmount: null,
    });
    expect(result.transactionAmount).toBeNull();
    expect(result.settlementNetAmount).toBeNull();
  });

  it("converts string numeric amounts to number", () => {
    const result = mapTransaction({
      ...BASE_ROW,
      transactionAmount: "12345.5" as unknown as number,
      settlementNetAmount: "9999" as unknown as number,
    });
    expect(result.transactionAmount).toBe(12345.5);
    expect(result.settlementNetAmount).toBe(9999);
  });

  it("passes null description and optional fields through", () => {
    const result = mapTransaction({
      ...BASE_ROW,
      description: null,
      status: null,
      externalReference: null,
      sourceId: null,
      paymentMethod: null,
    });
    expect(result.description).toBeNull();
    expect(result.status).toBeNull();
    expect(result.externalReference).toBeNull();
    expect(result.sourceId).toBeNull();
    expect(result.paymentMethod).toBeNull();
  });
});
