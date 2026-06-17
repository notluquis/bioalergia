import { describe, expect, it } from "vitest";

import {
  absoluteUrl,
  articleJsonLd,
  breadcrumbJsonLd,
  clinicJsonLd,
  faqJsonLd,
  physicianJsonLd,
  SITE_ORIGIN,
} from "./seo";

describe("absoluteUrl", () => {
  it("returns absolute URLs untouched", () => {
    expect(absoluteUrl("https://example.com/x")).toBe("https://example.com/x");
    expect(absoluteUrl("http://example.com")).toBe("http://example.com");
  });

  it("prefixes the origin for root-relative paths", () => {
    expect(absoluteUrl("/equipo")).toBe(`${SITE_ORIGIN}/equipo`);
  });

  it("inserts a leading slash for bare paths", () => {
    expect(absoluteUrl("equipo")).toBe(`${SITE_ORIGIN}/equipo`);
  });
});

describe("clinicJsonLd", () => {
  it("emits a schema.org MedicalClinic with contact data", () => {
    const ld = clinicJsonLd();
    expect(ld["@type"]).toBe("MedicalClinic");
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld.url).toBe(SITE_ORIGIN);
    expect(ld.medicalSpecialty).toBe("Allergy");
    expect((ld.address as Record<string, unknown>)["@type"]).toBe("PostalAddress");
  });
});

describe("physicianJsonLd", () => {
  it("emits a Physician affiliated with the clinic", () => {
    const ld = physicianJsonLd();
    expect(ld["@type"]).toBe("Physician");
    expect(ld.url).toBe(`${SITE_ORIGIN}/equipo`);
    expect((ld.affiliation as Record<string, unknown>).name).toBe("Clínica Bioalergia");
  });
});

describe("faqJsonLd", () => {
  it("maps each item to a Question/Answer pair", () => {
    const ld = faqJsonLd([
      { question: "¿Q1?", answer: "A1" },
      { question: "¿Q2?", answer: "A2" },
    ]);
    expect(ld["@type"]).toBe("FAQPage");
    const entities = ld.mainEntity as Array<Record<string, unknown>>;
    expect(entities).toHaveLength(2);
    expect(entities[0].name).toBe("¿Q1?");
    expect((entities[0].acceptedAnswer as Record<string, unknown>).text).toBe("A1");
  });

  it("handles an empty list", () => {
    expect((faqJsonLd([]).mainEntity as unknown[]).length).toBe(0);
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers positions from 1 and absolutizes each path", () => {
    const ld = breadcrumbJsonLd([
      { name: "Inicio", path: "/" },
      { name: "Tienda", path: "/tienda" },
    ]);
    expect(ld["@type"]).toBe("BreadcrumbList");
    const items = ld.itemListElement as Array<Record<string, unknown>>;
    expect(items[0].position).toBe(1);
    expect(items[1].position).toBe(2);
    expect(items[1].item).toBe(`${SITE_ORIGIN}/tienda`);
  });
});

describe("articleJsonLd", () => {
  it("includes datePublished only when provided", () => {
    const withDate = articleJsonLd({
      title: "T",
      description: "D",
      path: "/aprende/x",
      datePublished: "2026-01-01",
    });
    expect(withDate.datePublished).toBe("2026-01-01");
    expect(withDate.url).toBe(`${SITE_ORIGIN}/aprende/x`);
    expect(withDate.headline).toBe("T");

    const withoutDate = articleJsonLd({ title: "T", description: "D", path: "/aprende/x" });
    expect(withoutDate).not.toHaveProperty("datePublished");
  });

  it("types the article as Article + MedicalWebPage", () => {
    const ld = articleJsonLd({ title: "T", description: "D", path: "/a" });
    expect(ld["@type"]).toEqual(["Article", "MedicalWebPage"]);
  });
});
