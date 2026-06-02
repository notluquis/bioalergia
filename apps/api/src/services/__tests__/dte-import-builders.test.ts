import type { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  buildDtePurchaseDetail,
  buildDteSaleDetail,
  resolveOtherTaxes,
} from "../dte-import.ts";

// Pure CSV/Haulmer-row → DTE-detail transforms (no DB). Covers the SII
// "Otros Impuestos" normalization, the exempt-amount derivation, and the
// column defaults — the financial-correctness core of the import pipeline.

const num = (v: unknown) => (v as Decimal).toNumber();

describe("resolveOtherTaxes", () => {
  it("returns null when no tax columns are present", () => {
    expect(resolveOtherTaxes({})).toBeNull();
  });

  it("builds a single entry from scalar code/amount/rate columns", () => {
    expect(
      resolveOtherTaxes({ otherTaxCode: "271", otherTaxAmount: "1000", otherTaxRate: "10" })
    ).toEqual([{ code: "271", rate: 10, amount: 1000 }]);
  });

  it("treats a plain scalar amount (no code) as a single bare entry", () => {
    expect(resolveOtherTaxes({ otherTaxAmount: "161" })).toEqual([
      { code: "", rate: null, amount: 161 },
    ]);
  });

  it("decodes a multi-tax JSON blob in the amount column", () => {
    const blob = JSON.stringify([
      { codigo: "271", tasa: 10, monto: 500 },
      { codigo: "23", tasa: 20, monto: 300 },
    ]);
    expect(resolveOtherTaxes({ otherTaxAmount: blob })).toEqual([
      { code: "271", rate: 10, amount: 500 },
      { code: "23", rate: 20, amount: 300 },
    ]);
  });

  it("unwraps a doubly JSON-encoded blob (Haulmer double-encodes)", () => {
    const inner = JSON.stringify([{ codigo: "271", tasa: 10, monto: 500 }]);
    const doubly = JSON.stringify(inner);
    expect(resolveOtherTaxes({ otherTaxAmount: doubly })).toEqual([
      { code: "271", rate: 10, amount: 500 },
    ]);
  });
});

describe("buildDteSaleDetail — exempt amount derivation", () => {
  it("uses the provided exempt amount when > 0", () => {
    const d = buildDteSaleDetail({
      exemptAmount: "500",
      netAmount: "1000",
      ivaAmount: "190",
      totalAmount: "1690",
    });
    expect(num(d.exemptAmount)).toBe(500);
  });

  it("is 0 when net + iva equals total (fully taxed)", () => {
    const d = buildDteSaleDetail({
      exemptAmount: "0",
      netAmount: "1000",
      ivaAmount: "190",
      totalAmount: "1190",
    });
    expect(num(d.exemptAmount)).toBe(0);
  });

  it("derives exempt = total − net − iva when missing", () => {
    const d = buildDteSaleDetail({
      exemptAmount: "0",
      netAmount: "1000",
      ivaAmount: "190",
      totalAmount: "1690",
    });
    expect(num(d.exemptAmount)).toBe(500);
  });

  it("caps a negative derived exempt at 0", () => {
    const d = buildDteSaleDetail({
      exemptAmount: "0",
      netAmount: "2000",
      ivaAmount: "380",
      totalAmount: "1000",
    });
    expect(num(d.exemptAmount)).toBe(0);
  });

  it("applies SII defaults for missing identity columns", () => {
    const d = buildDteSaleDetail({});
    expect(d.documentType).toBe(41);
    expect(d.clientRUT).toBe("66666666-6");
    expect(d.clientName).toBe("Cliente sin identificar");
    expect(d.saleType).toBe("Del Giro");
    expect(d.origin).toBe("UPLOAD");
  });
});

describe("buildDtePurchaseDetail", () => {
  it("applies purchase defaults", () => {
    const d = buildDtePurchaseDetail({});
    expect(d.documentType).toBe(33);
    expect(d.purchaseType).toBe("Compras del Giro");
  });

  it("falls back providerName: providerName → clientName → Razón Social", () => {
    expect(buildDtePurchaseDetail({ clientName: "Acme" }).providerName).toBe("Acme");
    expect(buildDtePurchaseDetail({ "Razón Social": "Proveedora SpA" }).providerName).toBe(
      "Proveedora SpA"
    );
  });

  it("mirrors the first tax into scalar otherTax* columns + full array", () => {
    const d = buildDtePurchaseDetail({
      otherTaxCode: "271",
      otherTaxAmount: "1000",
      otherTaxRate: "10",
    });
    expect(d.otherTaxCode).toBe("271");
    expect(num(d.otherTaxAmount)).toBe(1000);
    expect(num(d.otherTaxRate)).toBe(10);
    expect(d.otherTaxes).toEqual([{ code: "271", rate: 10, amount: 1000 }]);
  });
});
