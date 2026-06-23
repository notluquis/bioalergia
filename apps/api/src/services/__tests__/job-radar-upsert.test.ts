import { describe, expect, it, vi } from "vitest";
import type { RawJob } from "../../modules/job-radar/types.ts";

vi.mock("@finanzas/db", () => ({ db: {}, kysely: {} }));

const { dedupeJobsForUpsert } = await import("../job-radar.ts");

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
