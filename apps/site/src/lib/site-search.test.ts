import { describe, expect, it } from "vitest";

import { normalize, searchSite } from "./site-search";

const pages = [
  { title: "Servicios", description: "Consultas de alergología clínica." },
  { title: "Inmunoterapia", description: "Vacunas para la alergia." },
];
const topics = [
  { title: "Rinitis alérgica", summary: "Inflamación de la mucosa nasal." },
  { title: "Asma", summary: "Vía aérea inflamada." },
];
const articles = [
  { title: "Polen en primavera", excerpt: "Niveles de polen elevados." },
  { title: "Nuevo equipo", excerpt: "Sumamos especialistas." },
];

const sources = { pages, topics, articles };

describe("normalize", () => {
  it("strips diacritics and lowercases", () => {
    expect(normalize("Alérgica")).toBe("alergica");
  });

  it("leaves already-normalized text unchanged", () => {
    expect(normalize("asma")).toBe("asma");
  });
});

describe("searchSite", () => {
  it("returns empty results for an empty query", () => {
    expect(searchSite("", sources)).toEqual({ pages: [], topics: [], articles: [] });
  });

  it("returns empty results for a whitespace-only query", () => {
    expect(searchSite("   ", sources)).toEqual({ pages: [], topics: [], articles: [] });
  });

  it("returns empty arrays when nothing matches", () => {
    expect(searchSite("zzz-no-match", sources)).toEqual({
      pages: [],
      topics: [],
      articles: [],
    });
  });

  it("matches case-insensitively", () => {
    const r = searchSite("SERVICIOS", sources);
    expect(r.pages).toEqual([pages[0]]);
  });

  it("matches accent-insensitively", () => {
    const r = searchSite("alergica", sources);
    expect(r.topics).toEqual([topics[0]]);
  });

  it("matches against the description/summary/excerpt fields too", () => {
    expect(searchSite("vacunas", sources).pages).toEqual([pages[1]]);
    expect(searchSite("nasal", sources).topics).toEqual([topics[0]]);
    expect(searchSite("elevados", sources).articles).toEqual([articles[0]]);
  });

  it("matches across all three sources at once", () => {
    // "a" appears in every title/field — broad match.
    const r = searchSite("a", sources);
    expect(r.pages.length).toBeGreaterThan(0);
    expect(r.topics.length).toBeGreaterThan(0);
    expect(r.articles.length).toBeGreaterThan(0);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(searchSite("  asma  ", sources).topics).toEqual([topics[1]]);
  });
});
