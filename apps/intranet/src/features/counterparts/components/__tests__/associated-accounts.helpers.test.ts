import { describe, expect, it } from "vitest";
import {
  accountFilterKey,
  buildAccountTransactionFilter,
  normalizeAccountNumber,
} from "../associated-accounts.helpers";

describe("normalizeAccountNumber", () => {
  it("removes whitespace and uppercases", () => {
    expect(normalizeAccountNumber("  abc 123  ")).toBe("ABC123");
  });

  it("strips leading zeros", () => {
    expect(normalizeAccountNumber("00012345")).toBe("12345");
  });

  it("returns '0' for all-zeros", () => {
    expect(normalizeAccountNumber("0000")).toBe("0");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeAccountNumber("")).toBe("");
  });

  it("preserves non-numeric characters after stripping zeros", () => {
    expect(normalizeAccountNumber("00A1B2")).toBe("A1B2");
  });
});

describe("accountFilterKey", () => {
  it("returns accountNumber when present", () => {
    expect(accountFilterKey({ accountNumber: "123" })).toBe("123");
  });

  it("returns empty string when accountNumber absent", () => {
    expect(accountFilterKey({})).toBe("");
  });
});

describe("buildAccountTransactionFilter", () => {
  it("normalizes account number", () => {
    const filter = buildAccountTransactionFilter({
      accountNumber: "0001234",
      accountType: "checking",
      bankName: "Banco X",
      counterpartId: 1,
      id: 1,
    });
    expect(filter.accountNumber).toBe("1234");
  });

  it("falls back to trimmed original if normalized is empty", () => {
    const filter = buildAccountTransactionFilter({
      accountNumber: "  ",
      accountType: "checking",
      bankName: "Banco X",
      counterpartId: 1,
      id: 2,
    });
    expect(filter.accountNumber).toBe("");
  });
});
