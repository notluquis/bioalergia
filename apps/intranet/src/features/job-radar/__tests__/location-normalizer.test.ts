import { describe, expect, it } from "vitest";
import type { JobPostingDTO } from "@finanzas/orpc-contracts/job-radar";
import {
  buildLocationFilterOptions,
  matchesLocationFilter,
  normalizeJobLocation,
} from "../location-normalizer";

function p(location: string | null, remote: string | null = null): JobPostingDTO {
  return {
    id: Math.random().toString(36),
    source: "muevete",
    company: "Falabella",
    externalId: "x",
    title: "Analista",
    url: "https://x",
    department: null,
    location,
    remote,
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

  it("normalizes historical Chilean region labels from job boards", () => {
    const negrete = normalizeJobLocation("Negrete, VIII del Biobío");
    const mariquina = normalizeJobLocation("Mariquina, XIV de Los Ríos");

    expect(negrete.label).toBe("Negrete, Biobío");
    expect(negrete.filterKeys).toContain("region:biobio");
    expect(mariquina.label).toBe("Mariquina, Los Ríos");
    expect(mariquina.filterKeys).toContain("region:los rios");
  });

  it("does not match commune aliases inside longer words", () => {
    const location = normalizeJobLocation("Quillota, CL");

    expect(location.normalized).toBe(true);
    expect(location.label).toBe("Quillota, Valparaíso");
    expect(location.filterKeys).toContain("commune:quillota");
    expect(location.filterKeys).toContain("region:valparaiso");
    expect(location.filterKeys).not.toContain("commune:lota");
    expect(location.filterKeys).not.toContain("zone:gran-concepcion");
  });

  it("keeps the raw value visible when automatic normalization is not possible", () => {
    const location = normalizeJobLocation("Boadilla del Monte");

    expect(location.normalized).toBe(true);
    expect(location.filterKeys).toEqual(["country:international"]);
  });

  it("groups country-only Chile values without pretending they are communes", () => {
    const location = normalizeJobLocation("Chile, CL");

    expect(location.normalized).toBe(true);
    expect(location.filterKeys).toEqual(["country:chile"]);
  });

  it("infers Chile from Chilean communes and regions without matching short foreign aliases", () => {
    const cases: Array<[string, string]> = [
      ["Lo Espejo, Metropolitana, Chile", "Lo Espejo, Región Metropolitana"],
      ["San Pedro de Atacama, Antofagasta, Chile", "San Pedro de Atacama, Antofagasta"],
      ["Illapel, Coquimbo", "Illapel, Coquimbo"],
      ["Independencia, Metropolitana, Chile", "Independencia, Región Metropolitana"],
      ["Peñalolén, Metropolitana, Chile", "Peñalolén, Región Metropolitana"],
      ["Nueva Imperial, La Araucanía", "Nueva Imperial, La Araucanía"],
    ];

    for (const [raw, label] of cases) {
      const location = normalizeJobLocation(raw);

      expect(location.normalized).toBe(true);
      expect(location.label).toBe(label);
      expect(location.filterKeys).toContain("country:chile");
      expect(location.filterKeys).not.toContain("country:peru");
    }
  });

  it("keeps genuinely unknown values in the review bucket", () => {
    const location = normalizeJobLocation("AIR Office");

    expect(location.normalized).toBe(false);
    expect(location.label).toBe("AIR Office");
    expect(location.filterKeys).toEqual(["unnormalized"]);
  });

  it("uses remote mode as a filterable location signal", () => {
    const location = normalizeJobLocation(null, "Remoto");

    expect(location.normalized).toBe(true);
    expect(location.label).toBe("Remoto");
    expect(location.filterKeys).toEqual(["mode:remoto", "remote:unknown"]);
  });

  it("splits remote roles by Chile versus international location", () => {
    const chile = normalizeJobLocation("America/Santiago", "remote");
    const argentina = normalizeJobLocation("Buenos Aires, Argentina", "Remoto");

    expect(chile.filterKeys).toContain("country:chile");
    expect(chile.filterKeys).toContain("remote:chile");
    // remote non-Chile no entra al bucket "Otros países": vive en remote:international
    expect(argentina.filterKeys).not.toContain("country:international");
    expect(argentina.filterKeys).toContain("remote:international");
  });

  it("builds filter options and matches rows by zone", () => {
    const rows = [
      p("Viña del Mar, Valparaíso, Chile"),
      p("Madrid"),
      p("AIR Office"),
      p(null, "Híbrido"),
      p("America/Santiago", "Remote"),
      p("Buenos Aires, Argentina", "Remoto"),
    ];
    const options = buildLocationFilterOptions(rows);

    expect(options.some((option) => option.key === "zone:gran-valparaiso")).toBe(true);
    expect(options.find((option) => option.key === "zone:gran-valparaiso")?.group).toBe("zone");
    expect(options.some((option) => option.key === "zone:gran-santiago")).toBe(false);
    expect(options.find((option) => option.key === "country:international")).toMatchObject({
      group: "country",
      label: "Otros países",
    });
    expect(options.find((option) => option.key === "mode:hibrido")?.group).toBe("mode");
    expect(options.find((option) => option.key === "remote:chile")).toMatchObject({
      group: "remote",
      label: "Remoto Chile",
    });
    expect(options.find((option) => option.key === "remote:international")).toMatchObject({
      group: "remote",
      label: "Remoto internacional",
    });
    expect(options.find((option) => option.key === "unnormalized")?.group).toBe("review");
    expect(matchesLocationFilter(rows[0]!, "zone:gran-valparaiso")).toBe(true);
    expect(matchesLocationFilter(rows[1]!, "country:international")).toBe(true);
    expect(matchesLocationFilter(rows[2]!, "unnormalized")).toBe(true);
    expect(matchesLocationFilter(rows[3]!, "mode:hibrido")).toBe(true);
    expect(matchesLocationFilter(rows[4]!, "remote:chile")).toBe(true);
    expect(matchesLocationFilter(rows[5]!, "remote:international")).toBe(true);
  });
});
