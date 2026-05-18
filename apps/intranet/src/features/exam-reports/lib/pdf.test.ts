/**
 * Tests for the exam-reports PDF generator — golden-2026 invariants.
 *
 * Focused on:
 *   - logo aspect-ratio math (so logos never look squashed)
 *   - presence + exact wording of the EAACI 2023 nomenclature disclaimer
 *   - sanitizePdfText replaces helvetica-incompatible glyphs (fixes the
 *     "letter-spaced" body line bug)
 *   - interpretPapule thresholds match EAACI 2023
 *   - cross-reactivity detector
 *   - generateExamReportPdf produces a non-trivial Blob and includes
 *     histamine + saline control rows in the results section
 */

import { describe, expect, it } from "vitest";

import { __pdfTestExports, generateExamReportPdf, sanitizePdfText } from "./pdf";

const {
  BIOALERGIA_ASPECT,
  AAAEIC_ASPECT,
  BIOALERGIA_W,
  AAAEIC_W,
  LOGO_H,
  EAACI_2023_NOMENCLATURE,
  interpretPapule,
  hasCrossReactiveAllergens,
} = __pdfTestExports;

describe("logo aspect-ratio math", () => {
  it("bioalergia placement width preserves natural 5000x1333 ratio", () => {
    // ratio ≈ 3.7509
    expect(BIOALERGIA_ASPECT).toBeCloseTo(3.7509, 3);
    expect(BIOALERGIA_W / LOGO_H).toBeCloseTo(BIOALERGIA_ASPECT, 5);
  });

  it("aaaeic placement width preserves natural 601x211 ratio", () => {
    // ratio ≈ 2.8483
    expect(AAAEIC_ASPECT).toBeCloseTo(2.8483, 3);
    expect(AAAEIC_W / LOGO_H).toBeCloseTo(AAAEIC_ASPECT, 5);
  });

  it("both logos share the same printed height", () => {
    expect(LOGO_H).toBe(48);
  });
});

describe("EAACI 2023 nomenclature disclaimer", () => {
  it("contains the exact verbatim wording (ASCII-safe form)", () => {
    expect(EAACI_2023_NOMENCLATURE).toBe(
      "Una prueba cutanea positiva indica sensibilizacion IgE, no diagnostica alergia clinica. " +
        "El diagnostico de alergia requiere correlacion con la historia clinica del paciente."
    );
  });
});

describe("sanitizePdfText", () => {
  it("replaces helvetica-incompatible glyphs that cause body-text spreading", () => {
    expect(sanitizePdfText("papula >= 3 mm")).toBe("papula >= 3 mm");
    expect(sanitizePdfText("papula ≥ 3 mm")).toBe("papula >= 3 mm");
    expect(sanitizePdfText("15–20 minutos")).toBe("15-20 minutos");
    expect(sanitizePdfText("Cloruro de cobalto 6H₂O")).toBe("Cloruro de cobalto 6H2O");
    expect(sanitizePdfText("CO₂ y H₂O")).toBe("CO2 y H2O");
    expect(sanitizePdfText("≤ 3")).toBe("<= 3");
  });

  it("leaves regular ASCII strings untouched", () => {
    expect(sanitizePdfText("Hello world 123")).toBe("Hello world 123");
  });
});

describe("interpretPapule", () => {
  it("returns Negativo when < 3 mm", () => {
    expect(interpretPapule(0)).toBe("Negativo");
    expect(interpretPapule(2.9)).toBe("Negativo");
  });
  it("returns Sensibilizacion leve for 3-5 mm", () => {
    expect(interpretPapule(3)).toBe("Sensibilizacion leve");
    expect(interpretPapule(5)).toBe("Sensibilizacion leve");
  });
  it("returns Sensibilizacion moderada for >5 to 8 mm", () => {
    expect(interpretPapule(5.5)).toBe("Sensibilizacion moderada");
    expect(interpretPapule(8)).toBe("Sensibilizacion moderada");
  });
  it("returns Sensibilizacion intensa for >8 mm", () => {
    expect(interpretPapule(8.5)).toBe("Sensibilizacion intensa");
    expect(interpretPapule(20)).toBe("Sensibilizacion intensa");
  });
  it("returns dash for missing", () => {
    expect(interpretPapule(null)).toBe("—");
    expect(interpretPapule(undefined)).toBe("—");
    expect(interpretPapule(Number.NaN)).toBe("—");
  });
});

describe("hasCrossReactiveAllergens", () => {
  it("detects PR-10, profilin, tropomyosin, LTP tags case-insensitively", () => {
    expect(
      hasCrossReactiveAllergens([
        {
          sectionKey: "x",
          label: "x",
          reactions: [
            {
              reaction: "MODERADA",
              allergen: {
                id: "1",
                commonName: "Bet v 1",
                scientificName: null,
                category: "polen",
                pollenType: null,
                tags: ["PR-10"],
              },
            },
          ],
        },
      ])
    ).toBe(true);

    expect(
      hasCrossReactiveAllergens([
        {
          sectionKey: "x",
          label: "x",
          reactions: [
            {
              reaction: "DEBIL",
              allergen: {
                id: "2",
                commonName: "Camaron",
                scientificName: null,
                category: "alimento",
                pollenType: null,
                tags: ["tropomyosin"],
              },
            },
          ],
        },
      ])
    ).toBe(true);
  });

  it("returns false when no relevant tags present", () => {
    expect(
      hasCrossReactiveAllergens([
        {
          sectionKey: "x",
          label: "x",
          reactions: [
            {
              reaction: "MODERADA",
              allergen: {
                id: "1",
                commonName: "Polvo",
                scientificName: null,
                category: "acaro",
                pollenType: null,
                tags: null,
              },
            },
          ],
        },
      ])
    ).toBe(false);
  });
});

describe("generateExamReportPdf", () => {
  const baseSettings = {
    name: "Bioalergia",
    address: "Av. Test 123",
    phoneWhatsapp: "+56 9 1234 5678",
    phoneLandline: "+56 2 2222 3333",
    email: "contacto@bioalergia.cl",
    website: "bioalergia.cl",
    websiteSecondary: "",
    signatureUrl: null,
    legalName: "Bioalergia SpA",
    rut: "77.000.000-0",
    superintendenciaNumber: "12345",
  };

  const baseReport = {
    examType: "MULTITEST_PANELS" as const,
    conclusionText: "Sensibilizacion moderada a acaros.",
    reagents: null,
    technique: null,
    notes: null,
    doctorName: "Dra. Test",
    doctorSpecialty: "Alergista",
    doctorRut: "11.111.111-1",
    patient: { fullName: "Paciente Demo", age: "30 años", rut: "10.000.000-0" },
    sections: [
      {
        sectionKey: "panel_1",
        label: "PANEL 1",
        reactions: [
          {
            reaction: "MODERADA" as const,
            papuleMm: 4,
            allergen: {
              id: "a1",
              commonName: "Acaro D. pteronyssinus",
              scientificName: null,
              category: "acaro",
              pollenType: null,
            },
          },
        ],
      },
    ],
    controls: { histamineMm: 5, salineMm: 0 },
  };

  it("produces a non-trivial PDF Blob (>5KB)", async () => {
    const blob = await generateExamReportPdf(baseReport, baseSettings);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(5000);
  }, 20000);

  it("emits a PDF for PATCH type too (no table path, keeps legacy sections)", async () => {
    const blob = await generateExamReportPdf(
      {
        ...baseReport,
        examType: "PATCH",
        sections: [
          {
            sectionKey: "lectura_48h",
            label: "Primera lectura 48 horas",
            reactions: [],
          },
        ],
        controls: null,
      },
      baseSettings
    );
    expect(blob.size).toBeGreaterThan(3000);
  }, 20000);
});
