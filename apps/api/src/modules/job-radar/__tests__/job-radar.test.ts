import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBciJobs } from "../bci.ts";
import { matchesProfile, type ProfileFilter } from "../filter.ts";
import { fetchGetonbrdJobs } from "../getonbrd.ts";
import { fetchGreenhouseJobs } from "../greenhouse.ts";
import { fetchLeverJobs } from "../lever.ts";
import { fetchTeamtailorJobs } from "../teamtailor.ts";
import type { RawJob } from "../types.ts";

const SITEMAP = `<?xml version="1.0"?>
<urlset>
  <url><loc>https://acme.teamtailor.com/</loc><lastmod>2026-06-01T00:00:00-04:00</lastmod></url>
  <url><loc>https://acme.teamtailor.com/jobs/100-analista-de-riesgo</loc><lastmod>2026-06-04T23:45:09-04:00</lastmod></url>
  <url><loc>https://acme.teamtailor.com/jobs/200-disenador-grafico</loc><lastmod>2026-06-03T10:00:00-04:00</lastmod></url>
</urlset>`;

// jobs.json solo trae el job 100 → el 200 cae al fallback de slug.
const JOBS_JSON = JSON.stringify({
  version: "https://jsonfeed.org/version/1.1",
  items: [
    {
      id: "uuid-1",
      title: "Analista de Riesgo Operacional",
      url: "https://acme.teamtailor.com/jobs/100-analista-de-riesgo",
      date_published: "2026-06-04T18:45:05-04:00",
      content_html: "<p>desc</p>",
      _jobposting: {
        "@type": "JobPosting",
        jobLocation: [{ "@type": "Place", address: { addressLocality: "Las Condes" } }],
      },
    },
  ],
});

function res(body: string, ok = true, status = 200): Response {
  return { ok, status, text: () => Promise.resolve(body) } as unknown as Response;
}

describe("fetchTeamtailorJobs", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/sitemap.xml")) return Promise.resolve(res(SITEMAP));
      if (url.endsWith("/jobs.json")) return Promise.resolve(res(JOBS_JSON));
      return Promise.resolve(res("", false, 404));
    });
  });

  afterEach(() => fetchSpy.mockRestore());

  it("merges sitemap (complete) with jobs.json metadata", async () => {
    const jobs = await fetchTeamtailorJobs("acme");
    expect(jobs).toHaveLength(2);

    const enriched = jobs.find((j) => j.externalId === "100");
    expect(enriched).toMatchObject({
      source: "teamtailor",
      company: "acme",
      title: "Analista de Riesgo Operacional",
      location: "Las Condes",
      descriptionHtml: "<p>desc</p>",
      url: "https://acme.teamtailor.com/jobs/100-analista-de-riesgo",
    });
    expect(enriched?.lastmod).toBeInstanceOf(Date);
    expect(enriched?.publishedAt).toBeInstanceOf(Date);
  });

  it("derives title from slug when job is absent from jobs.json", async () => {
    const jobs = await fetchTeamtailorJobs("acme");
    const fallback = jobs.find((j) => j.externalId === "200");
    expect(fallback?.title).toBe("Disenador Grafico");
    expect(fallback?.descriptionHtml).toBeNull();
    expect(fallback?.lastmod).toBeInstanceOf(Date);
  });

  it("ignores non-job sitemap entries", async () => {
    const jobs = await fetchTeamtailorJobs("acme");
    expect(jobs.every((j) => /^\d+$/.test(j.externalId))).toBe(true);
  });

  it("returns [] when sitemap fetch fails", async () => {
    fetchSpy.mockResolvedValue(res("", false, 500));
    expect(await fetchTeamtailorJobs("acme")).toEqual([]);
  });
});

const BCI_ES = JSON.stringify({
  hits: {
    total: 2,
    hits: [
      {
        _source: {
          id: 112152,
          title: "Analista de Riesgo Operacional ",
          public_url: "/offers/112152",
          commune_name: "Santiago",
          region_name: "Región Metropolitana",
          bci_department_title: "Gerencia de Riesgo",
          postulation_process_type_name: "Externo",
          is_peruvian_process: false,
          long_description: "<p>desc</p>",
          published_at_date_text: "04/06/2026",
          updated_at: "2026-06-04T18:01:27-04:00",
        },
      },
      {
        _source: {
          id: 112148,
          title: "Analista Riesgo Liquidez",
          public_url: "/offers/112148",
          commune_name: null,
          region_name: null,
          is_peruvian_process: true,
          postulation_process_type_name: "Proceso Bci Perú",
        },
      },
    ],
  },
});

describe("fetchBciJobs", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(res(BCI_ES));
  });
  afterEach(() => fetchSpy.mockRestore());

  it("maps ES _source hits to RawJob (CL + PE)", async () => {
    const jobs = await fetchBciJobs();
    expect(jobs).toHaveLength(2);
    const cl = jobs.find((j) => j.externalId === "112152");
    expect(cl).toMatchObject({
      source: "bci",
      company: "bci",
      title: "Analista de Riesgo Operacional",
      department: "Gerencia de Riesgo",
      location: "Santiago, Región Metropolitana",
      url: "https://trabajaenbci.cl/offers/112152",
    });
    const pe = jobs.find((j) => j.externalId === "112148");
    expect(pe?.location).toBe("Perú"); // sin comuna/región → fallback Perú
  });

  it("posts a match_all query to the public _search endpoint", async () => {
    await fetchBciJobs();
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/api/v3/bci_portals/_search");
    expect((opts as RequestInit).method).toBe("POST");
  });

  it("returns [] on non-ok", async () => {
    fetchSpy.mockResolvedValue(res("", false, 500));
    expect(await fetchBciJobs()).toEqual([]);
  });
});

const GH_JSON = JSON.stringify({
  jobs: [
    {
      id: 7376944,
      title: "Senior DevOps Engineer",
      absolute_url: "https://job-boards.greenhouse.io/chile/jobs/7376944",
      location: { name: "Santiago, Región Metropolitana, Chile" },
      content: "&lt;p&gt;desc&lt;/p&gt;",
      updated_at: "2026-06-01T10:00:00-04:00",
      first_published: "2026-05-20T10:00:00-04:00",
      departments: [{ name: "Engineering" }],
    },
  ],
});

describe("fetchGreenhouseJobs", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(res(GH_JSON));
  });
  afterEach(() => fetchSpy.mockRestore());

  it("maps Greenhouse jobs and hits the public board API", async () => {
    const jobs = await fetchGreenhouseJobs("chile");
    expect(String(fetchSpy.mock.calls[0][0])).toContain(
      "boards-api.greenhouse.io/v1/boards/chile/jobs"
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      source: "greenhouse",
      company: "chile",
      externalId: "7376944",
      title: "Senior DevOps Engineer",
      department: "Engineering",
      location: "Santiago, Región Metropolitana, Chile",
    });
    expect(jobs[0].publishedAt).toBeInstanceOf(Date);
  });

  it("returns [] on non-ok", async () => {
    fetchSpy.mockResolvedValue(res("", false, 404));
    expect(await fetchGreenhouseJobs("nope")).toEqual([]);
  });
});

const LV_JSON = JSON.stringify([
  {
    id: "abc-123",
    text: "Software Engineer",
    hostedUrl: "https://jobs.lever.co/fintual/abc-123",
    categories: { location: "Región Metropolitana de Santiago", team: "Engineering" },
    description: "<p>desc</p>",
    workplaceType: "remote",
    createdAt: 1_780_000_000_000,
  },
]);

describe("fetchLeverJobs", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(res(LV_JSON));
  });
  afterEach(() => fetchSpy.mockRestore());

  it("maps Lever postings and hits the public postings API", async () => {
    const jobs = await fetchLeverJobs("fintual");
    expect(String(fetchSpy.mock.calls[0][0])).toContain("api.lever.co/v0/postings/fintual");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      source: "lever",
      company: "fintual",
      externalId: "abc-123",
      title: "Software Engineer",
      department: "Engineering",
      location: "Región Metropolitana de Santiago",
      remote: "remote",
    });
    expect(jobs[0].publishedAt).toBeInstanceOf(Date);
  });

  it("returns [] on non-array", async () => {
    fetchSpy.mockResolvedValue(res("{}"));
    expect(await fetchLeverJobs("x")).toEqual([]);
  });
});

const GOB_JSON = JSON.stringify({
  meta: { page: 1, per_page: 50, total_pages: 1 },
  data: [
    {
      id: "data-analyst-chile-cumplo-santiago",
      type: "job",
      attributes: {
        title: "Data Analyst",
        description: "<p>desc</p>",
        category_name: "Data Science / Analytics",
        remote_modality: "hybrid",
        remote_zone: "America/Santiago",
        published_at: 1_780_690_567,
        company: { data: { attributes: { name: "Cumplo" } } },
      },
      links: { public_url: "https://www.getonbrd.com/jobs/data-analyst-chile-cumplo-santiago" },
    },
  ],
});

describe("fetchGetonbrdJobs", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(res(GOB_JSON));
  });
  afterEach(() => fetchSpy.mockRestore());

  it("queries the public search endpoint per keyword and maps jobs", async () => {
    const jobs = await fetchGetonbrdJobs(["data"]);
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/api/v0/search/jobs?query=data");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      source: "getonbrd",
      company: "getonbrd",
      externalId: "data-analyst-chile-cumplo-santiago",
      title: "Data Analyst · Cumplo",
      department: "Data Science / Analytics",
      remote: "hybrid",
      url: "https://www.getonbrd.com/jobs/data-analyst-chile-cumplo-santiago",
    });
    expect(jobs[0].publishedAt).toBeInstanceOf(Date);
  });

  it("dedupes across keywords and returns [] with no keywords", async () => {
    expect(await fetchGetonbrdJobs([])).toEqual([]);
    const jobs = await fetchGetonbrdJobs(["data", "riesgo"]);
    expect(jobs).toHaveLength(1); // mismo id en ambas queries → dedup
  });
});

function makeJob(over: Partial<RawJob>): RawJob {
  return {
    source: "teamtailor",
    company: "acme",
    externalId: "1",
    title: "Cargo X",
    url: "https://x",
    department: null,
    location: null,
    remote: null,
    descriptionHtml: null,
    publishedAt: null,
    lastmod: null,
    raw: null,
    ...over,
  };
}

describe("matchesProfile", () => {
  it("matches everything when filter is empty", () => {
    const filter: ProfileFilter = { keywords: [], departments: [] };
    expect(matchesProfile(makeJob({ title: "Cocinero" }), filter)).toBe(true);
  });

  it("matches keyword against title (case-insensitive)", () => {
    const filter: ProfileFilter = { keywords: ["riesgo"], departments: [] };
    expect(matchesProfile(makeJob({ title: "Analista de RIESGO" }), filter)).toBe(true);
    expect(matchesProfile(makeJob({ title: "Diseñador" }), filter)).toBe(false);
  });

  it("matches department exactly", () => {
    const filter: ProfileFilter = { keywords: [], departments: ["riesgo"] };
    expect(matchesProfile(makeJob({ department: "Riesgo" }), filter)).toBe(true);
    expect(matchesProfile(makeJob({ department: "Comercial" }), filter)).toBe(false);
  });
});
