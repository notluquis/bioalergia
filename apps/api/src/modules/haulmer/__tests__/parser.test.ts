import { describe, expect, it } from "vitest";
import { normalizeColumnName, normalizeRowHeaders, parseCSVText } from "../parser";

describe("normalizeColumnName", () => {
  it("maps known Spanish column names to camelCase keys", () => {
    expect(normalizeColumnName("monto total")).toBe("totalAmount");
    expect(normalizeColumnName("MONTO TOTAL")).toBe("totalAmount");
    expect(normalizeColumnName("rut cliente")).toBe("clientRUT");
    expect(normalizeColumnName("razón social")).toBe("clientName");
    expect(normalizeColumnName("folio")).toBe("folio");
    expect(normalizeColumnName("fecha documento")).toBe("documentDate");
    expect(normalizeColumnName("monto neto")).toBe("netAmount");
    expect(normalizeColumnName("monto iva")).toBe("ivaAmount");
    expect(normalizeColumnName("monto exento")).toBe("exemptAmount");
  });

  it("passes through unknown column names unchanged", () => {
    expect(normalizeColumnName("columna_desconocida")).toBe("columna_desconocida");
    expect(normalizeColumnName("custom_field")).toBe("custom_field");
  });

  it("handles trim + lowercase normalization", () => {
    expect(normalizeColumnName("  TOTAL  ")).toBe("totalAmount");
  });
});

describe("normalizeRowHeaders", () => {
  it("normalizes all keys in a row object", () => {
    const row = {
      "monto total": "10000",
      "rut cliente": "12345678-9",
      "razón social": "Empresa SA",
    };
    const result = normalizeRowHeaders(row);
    expect(result["totalAmount"]).toBe("10000");
    expect(result["clientRUT"]).toBe("12345678-9");
    expect(result["clientName"]).toBe("Empresa SA");
  });

  it("preserves values exactly", () => {
    const row = { folio: "123456" };
    expect(normalizeRowHeaders(row)).toEqual({ folio: "123456" });
  });
});

describe("parseCSVText", () => {
  it("parses semicolon-delimited CSV with headers", () => {
    const csv = `folio;monto total;rut cliente\n001;10000;12345678-9\n002;20000;98765432-1`;
    const rows = parseCSVText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.folio).toBe("001");
    expect(rows[0]?.["monto total"]).toBe("10000");
  });

  it("parses comma-delimited CSV", () => {
    const csv = `folio,total\n001,5000\n002,6000`;
    const rows = parseCSVText(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1]?.total).toBe("6000");
  });

  it("skips empty lines", () => {
    const csv = `folio;total\n001;1000\n\n002;2000\n`;
    const rows = parseCSVText(csv);
    expect(rows).toHaveLength(2);
  });

  it("returns empty array for header-only CSV", () => {
    const csv = `folio;total`;
    const rows = parseCSVText(csv);
    expect(rows).toHaveLength(0);
  });
});
