import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";

import { configureSuperjson } from "./superjson-config";

describe("configureSuperjson", () => {
  it("returns the same superjson instance on repeated calls", () => {
    const a = configureSuperjson();
    const b = configureSuperjson();
    expect(a).toBe(b);
  });

  it("round-trips a Decimal value", () => {
    const sj = configureSuperjson();
    const original = new Decimal("1234.5678");
    const serialized = sj.stringify({ amount: original });
    const parsed = sj.parse<{ amount: Decimal }>(serialized);
    expect(Decimal.isDecimal(parsed.amount)).toBe(true);
    expect(parsed.amount.toString()).toBe("1234.5678");
  });

  it("round-trips Date objects (built-in superjson support)", () => {
    const sj = configureSuperjson();
    const d = new Date("2024-01-15T10:30:00.000Z");
    const out = sj.parse<{ d: Date }>(sj.stringify({ d }));
    expect(out.d).toBeInstanceOf(Date);
    expect(out.d.toISOString()).toBe("2024-01-15T10:30:00.000Z");
  });

  it("preserves null and undefined inside objects", () => {
    const sj = configureSuperjson();
    const out = sj.parse<{ a: null; b: undefined }>(sj.stringify({ a: null, b: undefined }));
    expect(out.a).toBeNull();
    expect(out.b).toBeUndefined();
  });

  it("round-trips nested Decimals inside arrays", () => {
    const sj = configureSuperjson();
    const arr = [new Decimal("1"), new Decimal("2.5"), new Decimal("-3.14")];
    const out = sj.parse<{ list: Decimal[] }>(sj.stringify({ list: arr }));
    expect(out.list.map((x) => x.toString())).toEqual(["1", "2.5", "-3.14"]);
  });

  it("preserves NaN via superjson built-in", () => {
    const sj = configureSuperjson();
    const out = sj.parse<{ n: number }>(sj.stringify({ n: Number.NaN }));
    expect(Number.isNaN(out.n)).toBe(true);
  });
});
