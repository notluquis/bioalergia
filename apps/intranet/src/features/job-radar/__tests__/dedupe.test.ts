import { describe, expect, it } from "vitest";
import type { JobPostingDTO } from "@finanzas/orpc-contracts/job-radar";
import { dedupePostings } from "../dedupe";

function p(over: Partial<JobPostingDTO>): JobPostingDTO {
  return {
    id: Math.random().toString(36),
    source: "teamtailor",
    company: "tenpo",
    externalId: "x",
    title: "Analista de Riesgo",
    url: "https://x",
    department: null,
    location: null,
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
    ...over,
  };
}

describe("dedupePostings", () => {
  it("merges same title+employer across sources (Teamtailor + GetOnBoard)", () => {
    const rows = dedupePostings([
      p({
        source: "teamtailor",
        company: "tenpo",
        title: "Analista de Riesgo",
        descriptionHtml: "<p>d</p>",
      }),
      p({ source: "getonbrd", company: "getonbrd", title: "Analista de Riesgo · Tenpo" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe("teamtailor"); // board directo gana sobre agregador
    expect(rows[0]?.alsoOn).toEqual(["getonbrd"]);
  });

  it("does NOT merge same title at different employers", () => {
    const rows = dedupePostings([
      p({ source: "teamtailor", company: "tenpo", title: "Analista de Riesgo" }),
      p({ source: "teamtailor", company: "mindwork", title: "Analista de Riesgo" }),
    ]);
    expect(rows).toHaveLength(2);
  });

  it("ignores accents/case/punctuation when matching", () => {
    const rows = dedupePostings([
      p({ source: "bci", company: "bci", title: "Analista de Riesgo Operacional" }),
      p({ source: "getonbrd", company: "getonbrd", title: "analista de riesgo operacional · BCI" }),
    ]);
    expect(rows).toHaveLength(1);
  });

  it("leaves unique postings untouched (no alsoOn)", () => {
    const rows = dedupePostings([p({ title: "Data Engineer" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.alsoOn).toBeUndefined();
  });
});
