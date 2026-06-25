import { describe, expect, it } from "vitest";
import type { JobPostingDTO } from "@finanzas/orpc-contracts/job-radar";
import { applyOptimisticJobPatch, jobMatchesListFilters } from "../hooks/useJobRadar";

const baseJob: JobPostingDTO = {
  id: "job-1",
  source: "trabajando",
  company: "redsalud",
  externalId: "6089355",
  title: "Enfermera/o Asistencial",
  url: "https://redsalud.trabajando.cl/trabajo/6089355-enfermera-o-asistencial",
  department: null,
  location: "Concepción, Biobío",
  remote: null,
  salary: null,
  descriptionHtml: null,
  publishedAt: null,
  lastmod: null,
  status: "OPEN",
  notified: false,
  matched: false,
  applicationStatus: "NEW",
  appliedAt: null,
  statusUpdatedAt: null,
  notes: null,
  firstSeenAt: new Date("2026-06-24T12:00:00Z"),
  lastSeenAt: new Date("2026-06-24T12:00:00Z"),
};

describe("Job Radar optimistic cache patch", () => {
  it("removes a row from a status-filtered list when the new status no longer matches", () => {
    const next = applyOptimisticJobPatch(
      [baseJob],
      new Set([baseJob.id]),
      { applicationStatus: "SEEN", statusUpdatedAt: new Date("2026-06-24T12:05:00Z") },
      { postingStatus: "OPEN", applicationStatus: "NEW" }
    );

    expect(next).toEqual([]);
  });

  it("keeps and patches a row when the list filter still matches", () => {
    const next = applyOptimisticJobPatch(
      [baseJob],
      new Set([baseJob.id]),
      { applicationStatus: "SEEN" },
      { postingStatus: "OPEN" }
    );

    expect(next?.[0]?.applicationStatus).toBe("SEEN");
  });

  it("matches the server-side search fields used by Job Radar lists", () => {
    expect(jobMatchesListFilters(baseJob, { search: "biobío" })).toBe(true);
    expect(jobMatchesListFilters(baseJob, { search: "zurich" })).toBe(false);
  });
});
