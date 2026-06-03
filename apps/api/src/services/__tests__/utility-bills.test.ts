import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { cgeHeaders, essbioDateToISO, mapAccount, periodToEmissionDate } from "../utility-bills.ts";

type RawAccount = Parameters<typeof mapAccount>[0];

describe("essbioDateToISO", () => {
  it('converts "DD/MM/YYYY" to "YYYY-MM-DD"', () => {
    expect(essbioDateToISO("18/05/2026")).toBe("2026-05-18");
    expect(essbioDateToISO("01/12/1999")).toBe("1999-12-01");
    expect(essbioDateToISO("31/01/2000")).toBe("2000-01-31");
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(essbioDateToISO("  18/05/2026  ")).toBe("2026-05-18");
  });

  it("returns null for null/undefined/empty", () => {
    expect(essbioDateToISO(null)).toBeNull();
    expect(essbioDateToISO(undefined)).toBeNull();
    expect(essbioDateToISO("")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(essbioDateToISO("2026-05-18")).toBeNull(); // ISO, not DD/MM/YYYY
    expect(essbioDateToISO("5/5/2026")).toBeNull(); // single digits
    expect(essbioDateToISO("18/05/26")).toBeNull(); // 2-digit year
    expect(essbioDateToISO("18-05-2026")).toBeNull(); // dashes
    expect(essbioDateToISO("18/05/2026  extra")).toBeNull(); // trailing junk
    expect(essbioDateToISO("x18/05/2026")).toBeNull(); // leading junk
    expect(essbioDateToISO("not a date")).toBeNull();
  });
});

describe("periodToEmissionDate", () => {
  it('converts "MM/YYYY" to "YYYY-MM-01"', () => {
    expect(periodToEmissionDate("05/2026")).toBe("2026-05-01");
    expect(periodToEmissionDate("12/1999")).toBe("1999-12-01");
    expect(periodToEmissionDate("01/2000")).toBe("2000-01-01");
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(periodToEmissionDate("  05/2026  ")).toBe("2026-05-01");
  });

  it("returns null for malformed input", () => {
    expect(periodToEmissionDate("")).toBeNull();
    expect(periodToEmissionDate("2026-05")).toBeNull(); // dash format
    expect(periodToEmissionDate("202605")).toBeNull(); // no separator
    expect(periodToEmissionDate("5/2026")).toBeNull(); // single-digit month
    expect(periodToEmissionDate("05/26")).toBeNull(); // 2-digit year
    expect(periodToEmissionDate("05/2026/01")).toBeNull(); // extra component
    expect(periodToEmissionDate("18/05/2026")).toBeNull(); // DD/MM/YYYY
    expect(periodToEmissionDate("junk")).toBeNull();
  });
});

describe("cgeHeaders", () => {
  it("uses the provided token as x-api-auth", () => {
    const headers = cgeHeaders("my-cognito-token");
    expect(headers["x-api-auth"]).toBe("my-cognito-token");
  });

  it('falls back to "bioalergia" when token is null', () => {
    const headers = cgeHeaders(null);
    expect(headers["x-api-auth"]).toBe("bioalergia");
  });

  it("returns the exact full header set with a token", () => {
    expect(cgeHeaders("tok123")).toEqual({
      "Content-Type": "application/json",
      Accept: "*/*",
      Origin: "https://sucursalvirtual.cge.cl",
      Referer: "https://sucursalvirtual.cge.cl/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15",
      "X-Client": "react-app",
      "App-Source": "react-app",
      "x-api-auth": "tok123",
    });
  });

  it("returns the exact full header set with null token", () => {
    expect(cgeHeaders(null)).toEqual({
      "Content-Type": "application/json",
      Accept: "*/*",
      Origin: "https://sucursalvirtual.cge.cl",
      Referer: "https://sucursalvirtual.cge.cl/",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15",
      "X-Client": "react-app",
      "App-Source": "react-app",
      "x-api-auth": "bioalergia",
    });
  });

  it("keeps the auth header present and non-empty for both branches", () => {
    expect("x-api-auth" in cgeHeaders("t")).toBe(true);
    expect(cgeHeaders("t")["x-api-auth"]).not.toBe("");
    expect(cgeHeaders(null)["x-api-auth"]).not.toBe("");
  });
});

describe("mapAccount", () => {
  const baseAccount = {
    id: 7,
    provider: "CGE",
    serviceNumber: "123456",
    label: "Casa",
  } as unknown as RawAccount;

  it("converts Decimal lastAmount/lastPreviousAmount to numbers", () => {
    const result = mapAccount({
      ...baseAccount,
      lastAmount: new Decimal("45000"),
      lastPreviousAmount: new Decimal("38000.5"),
    } as RawAccount);

    expect(result.lastAmount).toBe(45000);
    expect(result.lastPreviousAmount).toBe(38000.5);
  });

  it("preserves null lastAmount/lastPreviousAmount as null (not 0)", () => {
    const result = mapAccount({
      ...baseAccount,
      lastAmount: null,
      lastPreviousAmount: null,
    } as RawAccount);

    expect(result.lastAmount).toBeNull();
    expect(result.lastPreviousAmount).toBeNull();
  });

  it("maps each side independently (one null, one set)", () => {
    const result = mapAccount({
      ...baseAccount,
      lastAmount: new Decimal("100"),
      lastPreviousAmount: null,
    } as RawAccount);

    expect(result.lastAmount).toBe(100);
    expect(result.lastPreviousAmount).toBeNull();
  });

  it("spreads all other fields through unchanged", () => {
    const result = mapAccount({
      ...baseAccount,
      lastAmount: new Decimal("1"),
      lastPreviousAmount: new Decimal("2"),
    } as RawAccount);

    expect(result.id).toBe(7);
    expect(result.provider).toBe("CGE");
    expect(result.serviceNumber).toBe("123456");
    expect(result.label).toBe("Casa");
  });

  it("treats zero Decimal as 0, not null", () => {
    const result = mapAccount({
      ...baseAccount,
      lastAmount: new Decimal("0"),
      lastPreviousAmount: new Decimal("0"),
    } as RawAccount);

    expect(result.lastAmount).toBe(0);
    expect(result.lastPreviousAmount).toBe(0);
  });
});
