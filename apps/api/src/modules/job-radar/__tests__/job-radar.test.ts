import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAiravirtualJobs } from "../airavirtual.ts";
import { fetchAshbyJobs } from "../ashby.ts";
import { fetchBciJobs } from "../bci.ts";
import { fetchBukJobs } from "../buk.ts";
import { fetchEmpleosPublicosJobs } from "../empleospublicos.ts";
import { learnedKeywordsFromText, matchesProfile, type ProfileFilter } from "../filter.ts";
import { fetchGetonbrdJobs } from "../getonbrd.ts";
import { fetchGreenhouseJobs } from "../greenhouse.ts";
import { fetchHirefrontJobs } from "../hirefront.ts";
import { fetchLeverJobs } from "../lever.ts";
import { fetchSmartRecruitersJobs } from "../smartrecruiters.ts";
import {
  __test__ as sourceIdentifierTest,
  normalizeJobSourceIdentifier,
} from "../source-identifiers.ts";
import { fetchSuccessFactorsJobs } from "../successfactors.ts";
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

  it("falls back to description text for location and remote mode", async () => {
    const jobsJson = JSON.stringify({
      version: "https://jsonfeed.org/version/1.1",
      items: [
        {
          id: "uuid-2",
          title: "Analista Contable",
          url: "https://acme.teamtailor.com/jobs/200-disenador-grafico",
          date_published: "2026-06-03T10:00:00-04:00",
          content_html: "<p>Posición basada en Argentina bajo modalidad híbrida.</p>",
          _jobposting: { "@type": "JobPosting" },
        },
      ],
    });
    fetchSpy.mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/sitemap.xml")) return Promise.resolve(res(SITEMAP));
      if (url.endsWith("/jobs.json")) return Promise.resolve(res(jobsJson));
      return Promise.resolve(res("", false, 404));
    });

    const jobs = await fetchTeamtailorJobs("acme");
    const fallback = jobs.find((j) => j.externalId === "200");
    expect(fallback).toMatchObject({ location: "Argentina", remote: "Híbrido" });
  });
});

describe("job location fallbacks", () => {
  afterEach(() => vi.restoreAllMocks());

  it("derives SuccessFactors RMK location from the URL/title when the tile field is absent", async () => {
    const html = `
      <li class="job-tile job-id-1333755362">
        <a class="jobTitle-link" data-url="/job/LOS-LAGOS-Supervisor-Mantenimiento-Proceso-Planta-Calbuco-X-regi%C3%B3n-LOS/1333755362/">Supervisor Mantenimiento Proceso - Planta Calbuco - X región</a>
      </li>`;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(res(html)).mockResolvedValue(res(""));

    const jobs = await fetchSuccessFactorsJobs("trabajos.aquachile.com");

    expect(jobs[0]).toMatchObject({ location: "Calbuco" });
  });

  it("uses SuccessFactors search rows as authoritative location metadata", async () => {
    const tiles = `
      <li class="job-tile job-id-1401666900">
        <a class="jobTitle-link" data-url="/job/Buenos-Aires-T%C3%A9cnico-Soporte-Jr-Buen/1401666900/">Técnico Soporte Jr</a>
      </li>
      <li class="job-tile job-id-1334067562">
        <a class="jobTitle-link" data-url="/FemsaSaludEcuador/job/DISTRITO-METROPOLITANO-DE-QUIT-PASANTE/1334067562/">PASANTE</a>
      </li>`;
    const searchRows = `
      <table>
        <tr class="data-row">
          <td class="colTitle hidden-phone"><a class="jobTitle-link" href="/job/Buenos-Aires-T%C3%A9cnico-Soporte-Jr-Buen/1401666900/">Técnico Soporte Jr</a></td>
          <td class="colLocation hidden-phone"><span class="jobLocation">Buenos Aires, Argentina</span></td>
          <td class="colFacility hidden-phone"><span class="jobFacility">Soporte Técnico</span></td>
          <td class="colDate hidden-phone"><span class="jobDate">19 jun 2026</span></td>
        </tr>
        <tr class="data-row">
          <td class="colTitle hidden-phone"><a class="jobTitle-link" href="/FemsaSaludEcuador/job/DISTRITO-METROPOLITANO-DE-QUIT-PASANTE/1334067562/">PASANTE</a></td>
          <td class="colLocation hidden-phone"><span class="jobLocation">DISTRITO METROPOLITANO DE QUITO, Ecuador</span></td>
          <td class="colFacility hidden-phone"><span class="jobFacility">Corporación GPF</span></td>
          <td class="colDate hidden-phone"><span class="jobDate">18 jun 2026</span></td>
        </tr>
      </table>`;
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(res(tiles))
      .mockResolvedValueOnce(res(""))
      .mockResolvedValueOnce(res(searchRows))
      .mockResolvedValue(res(""));

    const jobs = await fetchSuccessFactorsJobs("carrera.sonda.com");

    expect(jobs.find((job) => job.externalId === "1401666900")).toMatchObject({
      location: "Buenos Aires, Argentina",
      department: "Soporte Técnico",
      publishedAt: new Date("2026-06-19T12:00:00.000Z"),
    });
    expect(jobs.find((job) => job.externalId === "1334067562")).toMatchObject({
      location: "DISTRITO METROPOLITANO DE QUITO, Ecuador",
      department: "Corporación GPF",
    });
  });

  it("falls back to SuccessFactors detail location when listings only expose slugs", async () => {
    const tiles = `
      <li class="job-tile job-id-1401690400">
        <a class="jobTitle-link" data-url="/job/El-Paso-Technical-Coordinator-TX-79915/1401690400/">Technical Coordinator</a>
      </li>`;
    const detail = `
      <span class="joblayouttoken-label">Location: </span>
      <span data-careersite-propertyid="location">
        <p id="job-location" class="jobLocation job-location-inline">
          <span class="jobGeoLocation">El Paso, TX, US, 79915 </span>
        </p>
      </span>`;
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(res(tiles))
      .mockResolvedValueOnce(res(""))
      .mockResolvedValueOnce(res(""))
      .mockResolvedValueOnce(res(detail));

    const jobs = await fetchSuccessFactorsJobs("jobs.fcx.com");

    expect(jobs[0]).toMatchObject({ location: "El Paso, TX, US, 79915" });
  });

  it("enriches broad SuccessFactors country locations with detail region fields", async () => {
    const tiles = `
      <li class="job-tile job-id-1400543000">
        <a class="jobTitle-link" data-url="/job/Supervisor%28a%29-Carguio-y-Transporte-Spence/1400543000/">Supervisor(a) Carguio y Transporte | Spence</a>
      </li>`;
    const searchRows = `
      <table>
        <tr class="data-row">
          <td class="colTitle hidden-phone"><a class="jobTitle-link" href="/job/Supervisor%28a%29-Carguio-y-Transporte-Spence/1400543000/">Supervisor(a) Carguio y Transporte | Spence</a></td>
          <td class="colLocation hidden-phone"><span class="jobLocation">Chile</span></td>
        </tr>
      </table>`;
    const detail = `
      <span class="joblayouttoken-label">País del Empleo: </span>
      <span data-careersite-propertyid="location">
        <p id="job-location"><span class="jobGeoLocation">Chile </span></p>
      </span>
      <span class="joblayouttoken-label">Estado / Provincia del Empleo: </span>
      <span data-careersite-propertyid="customfield4">Antofagasta </span>
      <span class="joblayouttoken-label">Ubicación / Región del Empleo: </span>
      <span data-careersite-propertyid="city"> </span>`;
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(res(tiles))
      .mockResolvedValueOnce(res(""))
      .mockResolvedValueOnce(res(searchRows))
      .mockResolvedValueOnce(res(""))
      .mockResolvedValueOnce(res(detail));

    const jobs = await fetchSuccessFactorsJobs("careers.bhp.com");

    expect(jobs[0]).toMatchObject({ location: "Antofagasta, Chile" });
  });

  it("maps SuccessFactors tile fields by label, not by customfield index (codelco)", async () => {
    // codelco: customfield2 = Región (NO Gerencia), sin Lugar de Trabajo. El
    // mapeo por índice metía la región en Área y basura del path en Ubicación.
    const tiles = `
      <li class="job-tile job-id-1401321600">
        <a class="jobTitle-link" data-url="/job/Posada-Lilen-Convocatoria-Enfermeras-TENS-Reg_-8320000/1401321600/">Convocatoria Enfermeras &amp; TENS</a>
        <div class="section-field customfield1 fontcolorb6a"><span>ID de proceso</span> 89626</div>
        <div class="section-field date fontcolorb6a"><span>Fecha</span> 20 jun 2026</div>
        <div class="section-field customfield2 fontcolorb6a"><span>Región</span> 2da.Reg.Antofagasta</div>
        <div class="section-field zip fontcolorb6a"><span>Código postal</span> 1240000</div>
      </li>`;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(res(tiles)).mockResolvedValue(res(""));

    const jobs = await fetchSuccessFactorsJobs("empleos.codelco.cl");

    expect(jobs[0]).toMatchObject({
      title: "Convocatoria Enfermeras & TENS", // entidad &amp; decodificada
      department: null, // sin etiqueta de Gerencia → Área vacía, NO la región
      location: "Antofagasta", // desde "Región 2da.Reg.Antofagasta", no del path
      publishedAt: new Date("2026-06-20T12:00:00.000Z"),
    });
  });

  it("derives Buk location and remote mode from card text", async () => {
    const html = `
      <div class="jobs__card">
        <p class="d-none">Quilicura Desarrollador Salesforce remoto</p>
        <b>Desarrollador Salesforce</b>
        <a href="/s/47jSAE1zSjwqZftH">ver</a>
      </div>`;
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(res(html))
      .mockResolvedValueOnce(res(""))
      .mockResolvedValue(res(""));

    const jobs = await fetchBukJobs("tattersall");

    expect(jobs[0]).toMatchObject({ location: "Quilicura", remote: "Remoto" });
  });

  it("reads Buk card location from jobs__card-info", async () => {
    const html = `
      <div class="jobs__card">
        <b>Analista de Gestión Personas</b>
        <p class="d-none">Desarrollo Organizacional ANALISTA DE GESTIÓN PERSONAS</p>
        <div class="jobs__card-info">
          <span>Talca, VII  del Maule</span>
        </div>
        <a href="https://andessalud.buk.cl/s/sDoM7Gifvv8BLAv1">ver</a>
      </div>`;
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(res(html))
      .mockResolvedValueOnce(res(""))
      .mockResolvedValue(res(""));

    const jobs = await fetchBukJobs("andessalud");

    expect(jobs[0]).toMatchObject({
      company: "andessalud",
      externalId: "sDoM7Gifvv8BLAv1",
      location: "Talca, VII del Maule",
    });
  });

  it("enriches Buk jobs from detail JSON-LD", async () => {
    const listingHtml = `
      <div class="jobs__card">
        <b>Inbound SDR</b>
        <p class="d-none">Inbound Inbound SDR</p>
        <div class="jobs__card-info"><span></span></div>
        <a href="https://buk.buk.cl/s/8Bz1mb8iARbcqx1Q">ver</a>
      </div>`;
    const detailHtml = `
      <script type="application/ld+json">
        {
          "@context": "https://schema.org/",
          "@type": "JobPosting",
          "title": "Inbound SDR",
          "description": "Únete a Buk como nuestro próximo Inbound SDR.",
          "datePosted": "2026-06-16 11:14:37 -0400",
          "jobLocation": {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Santiago",
              "addressRegion": "Metropolitana",
              "addressCountry": "CL"
            }
          }
        }
      </script>`;
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(res(listingHtml))
      .mockResolvedValueOnce(res(""))
      .mockResolvedValueOnce(res(detailHtml));

    const jobs = await fetchBukJobs("buk");

    expect(jobs[0]).toMatchObject({
      title: "Inbound SDR",
      location: "Santiago, Metropolitana, CL",
      descriptionHtml: "Únete a Buk como nuestro próximo Inbound SDR.",
      publishedAt: new Date("2026-06-16T15:14:37.000Z"),
      lastmod: new Date("2026-06-16T15:14:37.000Z"),
    });
  });

  it("derives Hirefront region from the embedded title", async () => {
    const html = `
      <a href="/oferta-de-empleo/19829/ranking-auxiliar-de-servicios-varias-comunas-region-de-atacama-10/">
        <h3>Ranking: Auxiliar de Servicios. Varias Comunas. Región de Atacama <small>Publicado hace 2 días</small></h3>
        <i class="fa-clock-o"></i> Completa
      </a>`;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(res(html)).mockResolvedValue(res(""));

    const jobs = await fetchHirefrontJobs("junji");

    expect(jobs[0]).toMatchObject({ location: "Atacama" });
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

describe("normalizeJobSourceIdentifier", () => {
  it("extracts airavirtual company slug from job-board URLs", () => {
    expect(
      normalizeJobSourceIdentifier(
        "AIRAVIRTUAL",
        "https://jobs.airavirtual.com/be_corredores_de_la_bolsa#_ver_empleos"
      )
    ).toBe("be_corredores_de_la_bolsa");
  });

  it("extracts airavirtual company slug from public feed URLs", () => {
    expect(
      normalizeJobSourceIdentifier(
        "AIRAVIRTUAL",
        "https://gcs-files.airavirtual.com/public/feeds/aira_be_corredores_de_la_bolsa.json"
      )
    ).toBe("be_corredores_de_la_bolsa");
  });

  it("extracts trabajando slug from offer URLs", () => {
    expect(
      normalizeJobSourceIdentifier(
        "TRABAJANDO",
        "https://bancoestado.trabajando.cl/trabajo/6082022-operador-mesa-de-dinero-mayoristas"
      )
    ).toBe("bancoestado");
  });

  it("extracts airavirtual slug from login offer HTML assets", () => {
    expect(
      sourceIdentifierTest.extractAiravirtualSlugFromHtml(
        '<meta property="og:image" content="https://gcs-files.airavirtual.com/public/companies_assets/be_corredores_de_la_bolsa/WELCOME_RESOURCE-OFFER4914.jpg">'
      )
    ).toBe("be_corredores_de_la_bolsa");
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
