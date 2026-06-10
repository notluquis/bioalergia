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

    expect(location.normalized).toBe(true);
    expect(location.filterKeys).toEqual(["country:espana"]);
  });

  it("groups country-only Chile values without pretending they are communes", () => {
    const location = normalizeJobLocation("Chile, CL");

    expect(location.normalized).toBe(true);
    expect(location.filterKeys).toEqual(["country:chile"]);
  });

  it("keeps genuinely unknown values in the review bucket", () => {
    const location = normalizeJobLocation("AIR Office");

    expect(location.normalized).toBe(false);
    expect(location.label).toBe("AIR Office");
    expect(location.filterKeys).toEqual(["unnormalized"]);
  });

  it("builds filter options and matches rows by zone", () => {
    const rows = [p("Viña del Mar, Valparaíso, Chile"), p("Madrid"), p("AIR Office")];
    const options = buildLocationFilterOptions(rows);

    expect(options.some((option) => option.key === "zone:gran-valparaiso")).toBe(true);
    expect(options.find((option) => option.key === "zone:gran-valparaiso")?.group).toBe("zone");
    expect(options.some((option) => option.key === "zone:gran-santiago")).toBe(false);
    expect(options.find((option) => option.key === "country:espana")?.group).toBe("country");
    expect(options.find((option) => option.key === "unnormalized")?.group).toBe("review");
    expect(matchesLocationFilter(rows[0]!, "zone:gran-valparaiso")).toBe(true);
    expect(matchesLocationFilter(rows[1]!, "country:espana")).toBe(true);
    expect(matchesLocationFilter(rows[2]!, "unnormalized")).toBe(true);
  });
});
