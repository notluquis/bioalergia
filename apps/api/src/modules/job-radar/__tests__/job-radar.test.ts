import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAiravirtualJobs } from "../airavirtual.ts";
import { fetchAshbyJobs } from "../ashby.ts";
import { fetchBciJobs } from "../bci.ts";
import { fetchEmpleosPublicosJobs } from "../empleospublicos.ts";
import { learnedKeywordsFromText, matchesProfile, type ProfileFilter } from "../filter.ts";
import { fetchGetonbrdJobs } from "../getonbrd.ts";
import { fetchGreenhouseJobs } from "../greenhouse.ts";
import { fetchLeverJobs } from "../lever.ts";
import { fetchSmartRecruitersJobs } from "../smartrecruiters.ts";
import { fetchTeamtailorJobs } from "../teamtailor.ts";
import { fetchWorkdayJobs, parseWorkdayEntry } from "../workday.ts";
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

const ASHBY_JSON = JSON.stringify({
  jobs: [
    {
      id: "9c327e8b-1cf3-45da-a99a-e60420df8a0c",
      title: "Software Engineer",
      department: "Engineering",
      team: "Devs",
      location: "Chile",
      isRemote: true,
      workplaceType: "Remote",
      jobUrl: "https://jobs.ashbyhq.com/toku/9c327e8b",
      descriptionHtml: "<p>desc</p>",
      publishedAt: "2025-08-13T19:16:52.961+00:00",
    },
  ],
});

describe("fetchAshbyJobs", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(res(ASHBY_JSON));
  });
  afterEach(() => fetchSpy.mockRestore());

  it("maps Ashby posting-api jobs", async () => {
    const jobs = await fetchAshbyJobs("toku");
    expect(String(fetchSpy.mock.calls[0][0])).toContain(
      "api.ashbyhq.com/posting-api/job-board/toku"
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      source: "ashby",
      company: "toku",
      externalId: "9c327e8b-1cf3-45da-a99a-e60420df8a0c",
      title: "Software Engineer",
      department: "Engineering",
      location: "Chile",
      remote: "Remote",
      url: "https://jobs.ashbyhq.com/toku/9c327e8b",
    });
    expect(jobs[0].publishedAt).toBeInstanceOf(Date);
  });

  it("returns [] on non-ok", async () => {
    fetchSpy.mockResolvedValue(res("", false, 404));
    expect(await fetchAshbyJobs("nope")).toEqual([]);
  });
});

const SR_JSON = JSON.stringify({
  offset: 0,
  limit: 100,
  totalFound: 1,
  content: [
    {
      id: "744000130390560",
      name: "Finance Business Partner",
      refNumber: "REF27957O",
      releasedDate: "2026-06-05T08:22:58.881Z",
      location: {
        city: "Santiago",
        country: "cl",
        fullLocation: "Santiago, Chile",
        remote: false,
        hybrid: true,
      },
      department: { label: "Finanzas" },
      function: { label: "Purchasing" },
    },
  ],
});

describe("fetchSmartRecruitersJobs", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(res(SR_JSON));
  });
  afterEach(() => fetchSpy.mockRestore());

  it("maps SmartRecruiters postings", async () => {
    const jobs = await fetchSmartRecruitersJobs("Sodexo");
    expect(String(fetchSpy.mock.calls[0][0])).toContain(
      "api.smartrecruiters.com/v1/companies/Sodexo/postings"
    );
    expect(jobs[0]).toMatchObject({
      source: "smartrecruiters",
      company: "Sodexo",
      externalId: "744000130390560",
      title: "Finance Business Partner",
      department: "Finanzas",
      location: "Santiago, Chile",
      remote: "Híbrido",
      url: "https://jobs.smartrecruiters.com/Sodexo/744000130390560",
    });
    expect(jobs[0].publishedAt).toBeInstanceOf(Date);
  });
});

const WD_JSON = JSON.stringify({
  total: 1,
  jobPostings: [
    {
      title: "Analista de Riesgo",
      externalPath: "/job/Santiago/Analista-de-Riesgo_JR123",
      locationsText: "Santiago, Chile",
      postedOn: "Posted Today",
      bulletFields: ["JR123"],
    },
  ],
});

describe("workday", () => {
  it("parseWorkdayEntry parses tenant:wd:site (and rejects bad)", () => {
    expect(parseWorkdayEntry("nvidia:wd5:NVIDIAExternalCareerSite")).toEqual({
      tenant: "nvidia",
      wd: "wd5",
      site: "NVIDIAExternalCareerSite",
    });
    expect(parseWorkdayEntry("nope")).toBeNull();
    expect(parseWorkdayEntry("a:b")).toBeNull();
  });

  it("maps Workday CXS postings via searchText", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(res(WD_JSON));
    const entry = parseWorkdayEntry("falabella:wd3:Falabella")!;
    const jobs = await fetchWorkdayJobs(entry, ["riesgo"]);
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(
      "https://falabella.wd3.myworkdayjobs.com/wday/cxs/falabella/Falabella/jobs"
    );
    expect((opts as RequestInit).method).toBe("POST");
    expect(jobs[0]).toMatchObject({
      source: "workday",
      company: "falabella",
      externalId: "JR123",
      title: "Analista de Riesgo",
      location: "Santiago, Chile",
      url: "https://falabella.wd3.myworkdayjobs.com/Falabella/job/Santiago/Analista-de-Riesgo_JR123",
    });
    fetchSpy.mockRestore();
  });
});

const AIRA_JSON = JSON.stringify({
  updated_at: "2026-06-05",
  offers: [
    {
      id: 605364,
      name: "Analista de Riesgo Operacional",
      city: "chile##metropolitana##quilicura",
      region: "chile##metropolitana",
      country: "chile",
      area: "finanzas",
      subarea: "finanzas##riesgo",
      remote_work: "NO_REMOTE",
      link: "https://login.airavirtual.com/postula/abc123",
      publication_days: 1,
    },
  ],
});

describe("fetchAiravirtualJobs", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(res(AIRA_JSON));
  });
  afterEach(() => fetchSpy.mockRestore());

  it("maps airavirtual offers feed (cleans CL location/area)", async () => {
    const jobs = await fetchAiravirtualJobs("walmart");
    expect(String(fetchSpy.mock.calls[0][0])).toContain("feeds/aira_walmart.json");
    expect(jobs[0]).toMatchObject({
      source: "airavirtual",
      company: "walmart",
      externalId: "605364",
      title: "Analista de Riesgo Operacional",
      department: "Riesgo",
      location: "Quilicura, Metropolitana",
      remote: null,
      url: "https://login.airavirtual.com/postula/abc123",
    });
    expect(jobs[0].publishedAt).toBeInstanceOf(Date);
  });

  it("returns [] on non-ok", async () => {
    fetchSpy.mockResolvedValue(res("", false, 404));
    expect(await fetchAiravirtualJobs("nope")).toEqual([]);
  });
});

const EP_JSON =
  "﻿" +
  JSON.stringify([
    {
      Cargo: "Analista de Riesgo",
      "Institución / Entidad": "Servicio de Impuestos Internos",
      "Área de Trabajo": "Fiscalización",
      Región: "Región Metropolitana",
      Ciudad: "Santiago",
      "Renta Bruta": "1036481,00",
      "Fecha Inicio": "03/06/2026 0:00:00",
      url: "https://www.empleospublicos.cl/pub/convocatorias/convpostularavisoTrabajo.aspx?i=138836&c=0",
    },
  ]);

describe("fetchEmpleosPublicosJobs", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(res(EP_JSON));
  });
  afterEach(() => fetchSpy.mockRestore());

  it("parses the BOM JSON feed + formats salary/location/id", async () => {
    const jobs = await fetchEmpleosPublicosJobs();
    expect(String(fetchSpy.mock.calls[0][0])).toContain("convocatorias2_nueva.txt");
    expect(jobs[0]).toMatchObject({
      source: "empleospublicos",
      company: "empleospublicos",
      externalId: "138836",
      title: "Analista de Riesgo",
      department: "Servicio de Impuestos Internos",
      location: "Santiago, Región Metropolitana",
      salary: "$1.036.481",
    });
    expect(jobs[0].publishedAt).toBeInstanceOf(Date);
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
    salary: null,
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

  it("normalizes accents and searches inside descriptions", () => {
    const filter: ProfileFilter = { keywords: ["gestion operacional"], departments: [] };
    expect(
      matchesProfile(
        makeJob({ descriptionHtml: "<p>Gestión operacional y análisis de continuidad</p>" }),
        filter
      )
    ).toBe(true);
  });

  it("matches department exactly", () => {
    const filter: ProfileFilter = { keywords: [], departments: ["riesgo"] };
    expect(matchesProfile(makeJob({ department: "Riesgo" }), filter)).toBe(true);
    expect(matchesProfile(makeJob({ department: "Comercial" }), filter)).toBe(false);
  });

  it("learns repeated keywords from interested and applied samples", () => {
    expect(
      learnedKeywordsFromText([
        "Analista de Riesgo Operacional",
        "Especialista Riesgo Operacional",
        "Product Owner Datos",
      ])
    ).toEqual(expect.arrayContaining(["riesgo", "operacional", "riesgo operacional"]));
  });

  it("does not learn html/entity noise from descriptions", () => {
    expect(
      learnedKeywordsFromText([
        '<span class="x"><a href="https://x">Data Engineer</a></span>',
        '<span class="x"><a href="https://x">Data Analyst</a></span>',
      ])
    ).toEqual(expect.arrayContaining(["data"]));
    expect(
      learnedKeywordsFromText(['<span class="x">x</span>', '<span class="x">x</span>'])
    ).toEqual([]);
  });
});
