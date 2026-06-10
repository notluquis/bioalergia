import { describe, expect, it } from "vitest";
import type { JobPostingDTO } from "@finanzas/orpc-contracts/job-radar";
import {
  buildLocationFilterOptions,
  matchesLocationFilter,
  normalizeJobLocation,
} from "../location-normalizer";

function p(location: string | null): JobPostingDTO {
  return {
    id: Math.random().toString(36),
    source: "muevete",
    company: "Falabella",
    externalId: "x",
    title: "Analista",
    url: "https://x",
    department: null,
    location,
    remote: null,
    salary: null,
    descriptionHtml: null,
    publishedAt: null,
    lastmod: null,
    status: "OPEN",
    notified: false,
    matched: true,
    applicationStatus: "NEW",
    appliedAt: null,
    statusUpdatedAt: null,
    notes: null,
    firstSeenAt: new Date("2026-06-01"),
    lastSeenAt: new Date("2026-06-01"),
  };
}

describe("normalizeJobLocation", () => {
  it("normalizes Santiago variants into commune, region, and Gran Santiago", () => {
    const location = normalizeJobLocation("Las Condes, Metropolitana de Santiago");

    expect(location.normalized).toBe(true);
    expect(location.label).toBe("Las Condes, Región Metropolitana");
    expect(location.filterKeys).toContain("zone:gran-santiago");
    expect(location.filterKeys).toContain("region:region metropolitana");
    expect(location.filterKeys).toContain("commune:las condes");
  });

  it("normalizes accentless Gran Concepcion variants", () => {
    const location = normalizeJobLocation("Concepcion, Biobio");

    expect(location.normalized).toBe(true);
    expect(location.label).toBe("Concepción, Biobío");
    expect(location.filterKeys).toContain("zone:gran-concepcion");
  });

  it("keeps the raw value visible when automatic normalization is not possible", () => {
    const location = normalizeJobLocation("Boadilla del Monte");

    expect(location.normalized).toBe(false);
    expect(location.label).toBe("Boadilla del Monte");
    expect(location.filterKeys).toEqual(["unnormalized"]);
  });

  it("builds filter options and matches rows by zone", () => {
    const rows = [p("Viña del Mar, Valparaíso, Chile"), p("Madrid")];
    const options = buildLocationFilterOptions(rows);

    expect(options.some((option) => option.key === "zone:gran-valparaiso")).toBe(true);
    expect(matchesLocationFilter(rows[0]!, "zone:gran-valparaiso")).toBe(true);
    expect(matchesLocationFilter(rows[1]!, "unnormalized")).toBe(true);
  });
});
