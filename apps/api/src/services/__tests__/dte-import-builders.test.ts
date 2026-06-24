import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  areDataDifferent,
  buildDtePurchaseDetail,
  buildDteSaleDetail,
  parseAmount,
  parseDate,
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

  it("defaults otherTax scalar columns when there is no tax (amount=0, code/rate undefined)", () => {
    const d = buildDtePurchaseDetail({ providerRUT: "1-9", folio: "1" });
    expect(d.otherTaxCode).toBeUndefined();
    expect(d.otherTaxRate).toBeUndefined();
    expect(d.otherTaxes).toBeUndefined();
    // amount always materializes to Decimal(0), never undefined
    expect(num(d.otherTaxAmount)).toBe(0);
  });

  it("maps every monetary column to a Decimal (zero default) and parses the folio/RUT", () => {
    const d = buildDtePurchaseDetail({
      registerNumber: "7",
      documentType: "61",
      providerRUT: "76123456-7",
      folio: "200",
      period: "202605",
      exemptAmount: "100",
      netAmount: "1000",
      recoverableIVA: "190",
      nonRecoverableIVA: "5",
      totalAmount: "1290",
    });
    expect(d.registerNumber).toBe(7);
    expect(d.documentType).toBe(61);
    expect(d.providerRUT).toBe("76123456-7");
    expect(d.folio).toBe("200");
    expect(d.period).toBe("202605");
    expect(num(d.exemptAmount)).toBe(100);
    expect(num(d.netAmount)).toBe(1000);
    expect(num(d.recoverableIVA)).toBe(190);
    expect(num(d.nonRecoverableIVA)).toBe(5);
    expect(num(d.totalAmount)).toBe(1290);
  });

  it("providerName prefers providerName over clientName over Razón Social", () => {
    expect(
      buildDtePurchaseDetail({
        providerName: "Primary",
        clientName: "Secondary",
        "Razón Social": "Tertiary",
      }).providerName
    ).toBe("Primary");
  });
});

// ─── parseAmount arithmetic / format branches (kill Number/replace mutants) ───

describe("parseAmount — Chilean/European number formats", () => {
  it("strips a leading $ and inner spaces", () => {
    expect(parseAmount("$ 1 234")?.toNumber()).toBe(1234);
  });

  it("dot-thousands only (no decimals) collapses to integer", () => {
    expect(parseAmount("1.234.567")?.toNumber()).toBe(1234567);
  });

  it("does NOT treat a single dot as thousands when it is a decimal-looking value", () => {
    // "12.34" has no 3-digit group → not dot-thousands → parsed as plain Number 12.34
    expect(parseAmount("12.34")?.toNumber()).toBe(12.34);
  });

  it("comma-decimal, dot-thousands (European): last comma → decimal point", () => {
    expect(parseAmount("1.234,56")?.toNumber()).toBe(1234.56);
  });

  it("comma-thousands, dot-decimal (US): commas stripped, dot kept", () => {
    expect(parseAmount("1,234.56")?.toNumber()).toBe(1234.56);
  });

  it("comma-only as decimal separator", () => {
    expect(parseAmount("1234,5")?.toNumber()).toBe(1234.5);
  });

  it("returns null (not 0) for non-numeric junk", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("12x")).toBeNull();
  });

  it("treats a bare $ (empties to '') as Number('')=0 → Decimal(0)", () => {
    // documents the quirk: stripping $ leaves "", Number("") === 0, not NaN
    expect(parseAmount("$")?.toNumber()).toBe(0);
  });

  it("returns a Decimal instance, not a number", () => {
    expect(parseAmount("100")).toBeInstanceOf(Decimal);
  });
});

// ─── parseDate fallback chain (kill regex/branch mutants) ─────────────────────

describe("parseDate — format fallback chain", () => {
  it("ISO timestamp truncates to the date portion (UTC midnight)", () => {
    expect(parseDate("2022-06-01T11:49:01.000Z")?.toISOString()).toBe("2022-06-01T00:00:00.000Z");
  });

  it("space-separated timestamp → date-only via YYYY-MM-DD branch", () => {
    expect(parseDate("2026-02-06 11:19:56")?.toISOString()).toBe("2026-02-06T00:00:00.000Z");
  });

  it("DD/MM/YYYY pads single-digit day/month", () => {
    expect(parseDate("2/3/2026")?.toISOString()).toBe("2026-03-02T00:00:00.000Z");
  });

  it("DD-MM-YYYY and DD.MM.YYYY both parse to the same date", () => {
    expect(parseDate("08-02-2026")?.toISOString()).toBe("2026-02-08T00:00:00.000Z");
    expect(parseDate("08.02.2026")?.toISOString()).toBe("2026-02-08T00:00:00.000Z");
  });

  it("returns null on the Haulmer null markers and unparseable strings", () => {
    expect(parseDate("-/-/-")).toBeNull();
    expect(parseDate("-")).toBeNull();
    expect(parseDate("garbage")).toBeNull();
  });
});

// ─── buildDteSaleDetail exempt-derivation arithmetic (kill plus/minus/cmp) ────

describe("buildDteSaleDetail — exempt amount arithmetic precision", () => {
  const num = (v: unknown) => (v as Decimal).toNumber();

  it("derives exact exempt = total − net − iva (not off-by-one)", () => {
    const d = buildDteSaleDetail({
      exemptAmount: "0",
      netAmount: "1000",
      ivaAmount: "190",
      totalAmount: "1690",
    });
    expect(num(d.exemptAmount)).toBe(500);
  });

  it("keeps provided exempt verbatim even if it disagrees with the equation", () => {
    const d = buildDteSaleDetail({
      exemptAmount: "777",
      netAmount: "1000",
      ivaAmount: "190",
      totalAmount: "9999",
    });
    expect(num(d.exemptAmount)).toBe(777);
  });

  it("returns 0 (not the negative diff) when net+iva > total", () => {
    const d = buildDteSaleDetail({
      exemptAmount: "0",
      netAmount: "2000",
      ivaAmount: "380",
      totalAmount: "1000",
    });
    expect(num(d.exemptAmount)).toBe(0);
  });

  it("all-exempt special case: net=0 iva=0 total>0 → exempt=total", () => {
    const d = buildDteSaleDetail({
      exemptAmount: "0",
      netAmount: "0",
      ivaAmount: "0",
      totalAmount: "40000",
    });
    expect(num(d.exemptAmount)).toBe(40000);
  });
});

// ─── areDataDifferent value-comparison branches ──────────────────────────────

describe("areDataDifferent — typed comparison branches", () => {
  it("Decimal vs null new value counts as different", () => {
    expect(areDataDifferent({ amount: new Decimal("100") }, { amount: null })).toBe(true);
  });

  it("Decimal vs equal Decimal (different precision representation) is NOT different", () => {
    expect(
      areDataDifferent({ amount: new Decimal("100.00") }, { amount: new Decimal("100") })
    ).toBe(false);
  });

  it("Date vs equal Date (same epoch) is NOT different", () => {
    expect(
      areDataDifferent({ d: new Date("2026-01-01") }, { d: new Date("2026-01-01T00:00:00.000Z") })
    ).toBe(false);
  });

  it("jsonb arrays compared structurally, not by reference", () => {
    const existing = { otherTaxes: [{ code: "27", amount: 161 }] };
    expect(areDataDifferent(existing, { otherTaxes: [{ code: "27", amount: 161 }] })).toBe(false);
    expect(areDataDifferent(existing, { otherTaxes: [{ code: "27", amount: 999 }] })).toBe(true);
  });

  it("ignores ONLY id/createdAt/updatedAt — other keys still compared", () => {
    expect(
      areDataDifferent(
        { id: 1, createdAt: new Date(0), updatedAt: new Date(0), folio: "A" },
        { id: 2, createdAt: new Date(1), updatedAt: new Date(1), folio: "B" }
      )
    ).toBe(true);
  });

  it("returns false when newData is empty (nothing to compare)", () => {
    expect(areDataDifferent({ a: 1 }, {})).toBe(false);
  });
});
