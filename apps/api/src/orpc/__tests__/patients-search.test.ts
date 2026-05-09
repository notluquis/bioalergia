import { describe, expect, it } from "vitest";
import { buildPatientSearchWhere } from "../patients";

describe("buildPatientSearchWhere", () => {
  it("returns empty object for undefined query", () => {
    expect(buildPatientSearchWhere(undefined)).toEqual({});
  });

  it("returns empty object for blank query", () => {
    expect(buildPatientSearchWhere("   ")).toEqual({});
  });

  it("treats canonical and dotted RUT identically", () => {
    const a = buildPatientSearchWhere("20.275.995-5") as {
      person: { AND: Array<{ OR: Array<Record<string, unknown>> }> };
    };
    const b = buildPatientSearchWhere("20275995-5") as typeof a;

    const findRut = (entry: typeof a) =>
      entry.person.AND[0]!.OR.find((clause) => "rut" in clause)!.rut as { contains: string };

    expect(findRut(a).contains).toBe("20275995-5");
    expect(findRut(b).contains).toBe("20275995-5");
  });

  it("uppercases K check digit before search", () => {
    const w = buildPatientSearchWhere("11222333-k") as {
      person: { AND: Array<{ OR: Array<Record<string, unknown>> }> };
    };
    const rutClause = w.person.AND[0]!.OR.find((c) => "rut" in c)!.rut as { contains: string };
    expect(rutClause.contains).toBe("11222333-K");
  });

  it("matches partial RUT prefixes via contains", () => {
    // "2027" must search for "2027" so it can match canonical
    // "20275995-5"; if we collapsed to canonicalRutFilter it would
    // produce a fake "202-7" and miss real records.
    const w = buildPatientSearchWhere("2027") as {
      person: { AND: Array<{ OR: Array<Record<string, unknown>> }> };
    };
    const rutClause = w.person.AND[0]!.OR.find((c) => "rut" in c)!.rut as { contains: string };
    expect(rutClause.contains).toBe("2027");
  });

  it("strips dots from a partial dotted prefix", () => {
    const w = buildPatientSearchWhere("20.275") as {
      person: { AND: Array<{ OR: Array<Record<string, unknown>> }> };
    };
    const rutClause = w.person.AND[0]!.OR.find((c) => "rut" in c)!.rut as { contains: string };
    expect(rutClause.contains).toBe("20275");
  });

  it("falls back to raw token for non-RUT shaped queries (name search)", () => {
    const w = buildPatientSearchWhere("Lucas") as {
      person: { AND: Array<{ OR: Array<Record<string, unknown>> }> };
    };
    const rutClause = w.person.AND[0]!.OR.find((c) => "rut" in c)!.rut as { contains: string };
    expect(rutClause.contains).toBe("LUCAS");
  });

  it("splits multi-word queries into independent AND tokens", () => {
    const w = buildPatientSearchWhere("Lucas Pulgar") as {
      person: { AND: Array<unknown> };
    };
    expect(w.person.AND).toHaveLength(2);
  });

  it("never produces a where with the raw dotted RUT in the rut filter", () => {
    const w = buildPatientSearchWhere("20.275.995-5") as {
      person: { AND: Array<{ OR: Array<Record<string, unknown>> }> };
    };
    const rutClause = w.person.AND[0]!.OR.find((c) => "rut" in c)!.rut as { contains: string };
    expect(rutClause.contains).not.toContain(".");
  });
});
