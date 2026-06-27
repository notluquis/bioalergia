import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RawJob } from "../../modules/job-radar/types.ts";

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));

vi.mock("@finanzas/db", () => ({
  db: { jobPosting: { findMany: mockFindMany } },
  kysely: {},
}));

const { dedupeJobsForUpsert, listJobRadarFilterOptions } = await import("../job-radar.ts");

beforeEach(() => mockFindMany.mockReset());

function job(over: Partial<RawJob> = {}): RawJob {
  return {
    source: "trabajando",
    company: "carozzi",
    externalId: "123",
    title: "Analista",
    url: "https://example.test/jobs/123",
    department: null,
    location: null,
    remote: null,
    salary: null,
    descriptionHtml: null,
    publishedAt: null,
    lastmod: null,
    raw: { seq: 1 },
    ...over,
  };
}

describe("dedupeJobsForUpsert", () => {
  it("collapses rows that would hit the same ON CONFLICT target", () => {
    const result = dedupeJobsForUpsert([
      job({ title: "Analista", raw: { seq: 1 } }),
      job({ title: "Analista actualizado", raw: { seq: 2 } }),
    ]);

    expect(result.duplicateCount).toBe(1);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]?.title).toBe("Analista actualizado");
  });

  it("keeps the same external id when source or company differ", () => {
    const result = dedupeJobsForUpsert([
      job({ source: "trabajando", company: "carozzi", externalId: "123" }),
      job({ source: "trabajando", company: "gasco", externalId: "123" }),
      job({ source: "workday", company: "carozzi", externalId: "123" }),
    ]);

    expect(result.duplicateCount).toBe(0);
    expect(result.jobs).toHaveLength(3);
  });
});

describe("listJobRadarFilterOptions", () => {
  it("builds dependent facets from the active filters, excluding only the current facet", async () => {
    mockFindMany
      .mockResolvedValueOnce([{ applicationStatus: "NEW" }])
      .mockResolvedValueOnce([
        { source: "workday", company: "bci" },
        { source: "workday", company: "bci" },
      ])
      .mockResolvedValueOnce([{ location: "Santiago, Chile", remote: "Híbrido" }])
      .mockResolvedValueOnce([{ status: "OPEN" }])
      .mockResolvedValueOnce([{ source: "workday" }]);

    const result = await listJobRadarFilterOptions({
      postingStatus: "OPEN",
      applicationStatus: "SEEN",
      source: "workday",
      company: "bci",
      search: "data",
    });

    expect(result).toMatchObject({
      applicationStatuses: ["NEW"],
      companies: [{ source: "workday", value: "bci" }],
      postingStatuses: ["OPEN"],
      rawLocations: ["Santiago, Chile"],
      remoteModes: ["Híbrido"],
      sources: ["workday"],
    });
    expect(mockFindMany).toHaveBeenCalledTimes(5);
    expect(mockFindMany.mock.calls[0]?.[0].where).not.toHaveProperty("applicationStatus");
    expect(mockFindMany.mock.calls[1]?.[0].where).not.toHaveProperty("company");
    expect(mockFindMany.mock.calls[2]?.[0].where).toMatchObject({
      applicationStatus: "SEEN",
      company: "bci",
      source: "workday",
      status: "OPEN",
    });
    expect(mockFindMany.mock.calls[3]?.[0].where).not.toHaveProperty("status");
    expect(mockFindMany.mock.calls[4]?.[0].where).not.toHaveProperty("source");
  });
});
