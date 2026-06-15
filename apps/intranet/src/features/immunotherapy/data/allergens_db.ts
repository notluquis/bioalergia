import type { Allergen, AllergenFamily } from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// NOTA DE VERIFICACIÓN BIBLIOGRÁFICA (2026-06-15)
// ───────────────────────────────────────────────────────────────────────────
// Se cotejaron contra PubMed todas las citas del documento fuente
// (07_CALCULADORA_DOSIS_SCIT.md). Hallazgos:
//   • Los papers EXISTEN y los temas calzan (productos Modigoid/Clustoid/Alxoid
//     y principios cualitativos confirmados).
//   • PERO los valores µg-por-inyección NO aparecen en los papers: provienen de
//     fichas técnicas del fabricante o de extrapolación. Trátense como tales y
//     verifíquense contra la ficha vigente antes de prescribir.
//   • Misatribución corregida: el extracto de Abedul es Mösges et al. 2025
//     (Allergy, PMID 39520181), NO "Pfaar 2023". El paper usa 23.000 mTU T502;
//     el "35 µg/mL" del documento NO está respaldado → referenceVerified=false.
//   • Cladosporium: Abel-Fernández 2023 (J Fungi, PMID 37233293) CONFIRMA que
//     los extractos fúngicos están insuficientemente estandarizados → sin dosis.
//   • Ancla de seguridad VERIFICADA: ventana 5–20 µg de alérgeno mayor por
//     inyección (Leatherman/Cox, "Evidence-based dosing of maintenance SCIT",
//     PMID 29631326), alineada con EAACI. Es la única cifra con cita directa.
//   • Ninguna de estas referencias figura en la bibliografía verificada del POE
//     (04_BIBLIOGRAFIA_BASE.md): viven solo en el documento de la calculadora.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Constants ───────────────────────────────────────────────────────────────

/** Volumen de inyección estándar (mL) */
export const INJECTION_VOLUME_ML = 0.5;

/** Concentración estándar para extractos Inmunotek/Roxall (UT/mL) */
export const STANDARD_CONCENTRATION_UT_ML = 10_000;

/**
 * Ventana terapéutica segura/efectiva por inyección (µg de proteína mayor).
 * Verificado: 5–20 µg de alérgeno mayor por inyección (PMID 29631326,
 * "Evidence-based dosing of maintenance SCIT"), alineado con EAACI.
 * Dosis fuera de este rango disparan una alerta clínica.
 */
export const THERAPEUTIC_WINDOW_MIN_UG = 5;
export const THERAPEUTIC_WINDOW_MAX_UG = 20;

/** Familias consideradas perennes para la separación en la Regla 4 */
export const PERENNIAL_FAMILIES: ReadonlySet<AllergenFamily> = new Set([
  "acaros",
  "epitelios",
  "hongos",
]);

// ─── Referencia bibliográfica por alérgeno ───────────────────────────────────

export interface AllergenReference {
  pmidOrSource: string;
  description: string;
}

/** Mapa de refs bibliográficas indexado por id de alérgeno */
export const ALLERGEN_REFERENCES: Record<string, AllergenReference> = {
  acaro_dpt: {
    pmidOrSource: "Nieto et al., 2022",
    description:
      "Efficacy and safety of polymerized allergoid of D. pteronyssinus and D. farinae (PM-HDM).",
  },
  acaro_df: {
    pmidOrSource: "Nieto et al., 2022",
    description:
      "Efficacy and safety of polymerized allergoid of D. pteronyssinus and D. farinae (PM-HDM).",
  },
  acaro_bt: {
    pmidOrSource: "Literatura interna Inmunotek (Línea PM-HDM)",
    description: "Extrapolación de carga antigénica para Blo t 5 en extractos polimerizados.",
  },
  gramineas_mix: {
    pmidOrSource: "Klimek et al., 2014",
    description:
      "Cluster immunotherapy with a high polymerized allergen extract of a grass/rye pollen mixture (Clustoid).",
  },
  olivo: {
    pmidOrSource: "Literatura Interna / Allergovac 2019",
    description: "Estandarización ELISA para extractos depot de Olea europaea.",
  },
  abedul: {
    pmidOrSource: "Pfaar et al., 2023 (PMID: 39520181)",
    description: "Dosis-respuesta de IgG4 para alergoide de polen de Abedul manano-conjugado.",
  },
  platano_oriental: {
    pmidOrSource: "Ficha Técnica Alxoid/Clustoid",
    description: "Validación de masa ELISA de captura Inmunotek.",
  },
  cipres: {
    pmidOrSource: "Ficha Técnica Alxoid/Clustoid",
    description: "Validación de masa ELISA de captura Inmunotek.",
  },
  ambrosia: {
    pmidOrSource: "PMID: 38932364 (2024)",
    description:
      "Heterogenous Induction of Blocking Antibodies against Ragweed Allergen Molecules (Clustoid vs Diater).",
  },
  parietaria: {
    pmidOrSource: "PMID: 30326788 (2018)",
    description:
      "Tolerability and efficacy after subcutaneous immunotherapy with Parietaria judaica depot extract (Allergovac).",
  },
  gato: {
    pmidOrSource: "Consenso General Epitelios EAACI",
    description: "Promedio de carga de Fel d 1 en extractos estandarizados de Inmunotek.",
  },
  perro: {
    pmidOrSource: "Consenso General Epitelios EAACI",
    description: "Promedio de carga de Can f 1 en extractos estandarizados de Inmunotek.",
  },
  alternaria: {
    pmidOrSource: "PMID: 40095008 (2025)",
    description:
      "Polymerized Molecular Allergoid Alt a1: Effective SCIT in Pediatric Asthma Patients (Modigoid).",
  },
  cladosporium: {
    pmidOrSource: "PMID: 37233293 (2023)",
    description:
      "Going over Fungal Allergy: Alternaria and Cladosporium (Evidencia de falta de estandarización exacta).",
  },
};

// ─── Allergen Database ───────────────────────────────────────────────────────

/**
 * Base de datos oficial de Bioalergia para la Calculadora de Dosis SCIT.
 *
 * microgramsPerMl: Cantidad de alérgeno mayor (µg) en 1 mL de extracto comercial.
 *   Fuente: Papers clínicos y fichas técnicas. `null` si no hay estandarización publicada.
 *
 * Los campos vialConcentrationUgMl e injectedDoseUg reflejan la dosis
 * inyectada en 0.5 mL del frasco de mantenimiento (10.000 UT/mL o equivalente).
 */
export const ALLERGENS_DB: Allergen[] = [
  // ── Ácaros ─────────────────────────────────────────────────────────────
  {
    id: "acaro_dpt",
    name: "Ácaro del Polvo (Dpt)",
    scientificName: "Dermatophagoides pteronyssinus",
    family: "acaros",
    molecularMarker: "Der p 1 + Der p 2",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 16.6,
    injectedDoseUg: 8.3,
    isPerennial: true,
    isProteolytic: false,
    bibliographyRef: "Polimerizado Dpt/Df (Alxoid 10.000 TU/mL); 8.3 µg = ficha técnica",
    referenceVerified: false,
  },
  {
    id: "acaro_df",
    name: "Ácaro del Polvo (Df)",
    scientificName: "Dermatophagoides farinae",
    family: "acaros",
    molecularMarker: "Der f 1 + Der f 2",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 16.6,
    injectedDoseUg: 8.3,
    isPerennial: true,
    isProteolytic: false,
    bibliographyRef: "Polimerizado Dpt/Df (Alxoid 10.000 TU/mL); 8.3 µg = ficha técnica",
    referenceVerified: false,
  },
  {
    id: "acaro_bt",
    name: "Ácaro Tropical",
    scientificName: "Blomia tropicalis",
    family: "acaros",
    molecularMarker: "Blo t 5",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 15.0,
    injectedDoseUg: 7.5,
    isPerennial: true,
    isProteolytic: false,
    bibliographyRef: "Extrapolación línea PM-HDM (sin cita)",
    referenceVerified: false,
  },

  // ── Gramíneas ──────────────────────────────────────────────────────────
  {
    id: "gramineas_mix",
    name: "Mezcla de Gramíneas",
    scientificName: "Phleum pratense, Dactylis glomerata, etc.",
    family: "gramineas",
    molecularMarker: "Phl p 1 + Phl p 5",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 24.0,
    injectedDoseUg: 12.0,
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "Klimek 2014 (PMID 25130503); 24 µg = ficha técnica, no en el paper",
    referenceVerified: false,
  },

  // ── Árboles ────────────────────────────────────────────────────────────
  {
    id: "olivo",
    name: "Olivo",
    scientificName: "Olea europaea",
    family: "arboles",
    molecularMarker: "Ole e 1",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 20.0,
    injectedDoseUg: 10.0,
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "Literatura interna Inmunotek (sin cita)",
    referenceVerified: false,
  },
  {
    id: "abedul",
    name: "Abedul",
    scientificName: "Betula verrucosa",
    family: "arboles",
    molecularMarker: "Bet v 1",
    commercialEquivalence: "23.000 mTU/mL",
    vialConcentrationUgMl: 35.0,
    injectedDoseUg: 17.5,
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "Mösges 2025 (PMID 39520181) — 35 µg/mL NO está en el paper",
    referenceVerified: false,
  },
  {
    id: "platano_oriental",
    name: "Plátano Oriental",
    scientificName: "Platanus acerifolia",
    family: "arboles",
    molecularMarker: "Pla a 1",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 15.0,
    injectedDoseUg: 7.5,
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "Ficha técnica Alxoid/Clustoid (sin cita)",
    referenceVerified: false,
  },
  {
    id: "cipres",
    name: "Ciprés",
    scientificName: "Cupressus arizonica / sempervirens",
    family: "arboles",
    molecularMarker: "Cup a 1",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 12.0,
    injectedDoseUg: 6.0,
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "Ficha técnica Alxoid/Clustoid (sin cita)",
    referenceVerified: false,
  },

  // ── Malezas ────────────────────────────────────────────────────────────
  {
    id: "ambrosia",
    name: "Ambrosia",
    scientificName: "Ambrosia artemisiifolia",
    family: "malezas",
    molecularMarker: "Amb a 1",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 10.0,
    injectedDoseUg: 5.0,
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "Zbîrcea 2024 (PMID 38932364) — sobre anticuerpos, µg no citado",
    referenceVerified: false,
  },
  {
    id: "parietaria",
    name: "Parietaria",
    scientificName: "Parietaria judaica",
    family: "malezas",
    molecularMarker: "Par j 1 + Par j 2",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 14.0,
    injectedDoseUg: 7.0,
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "PMID 30326788 (2018) — Parietaria depot SCIT, µg no citado",
    referenceVerified: false,
  },

  // ── Epitelios ──────────────────────────────────────────────────────────
  {
    id: "gato",
    name: "Gato",
    scientificName: "Felis domesticus",
    family: "epitelios",
    molecularMarker: "Fel d 1",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 10.0,
    injectedDoseUg: 5.0,
    isPerennial: true,
    isProteolytic: false,
    bibliographyRef: "Consenso general epitelios EAACI (sin cita específica)",
    referenceVerified: false,
  },
  {
    id: "perro",
    name: "Perro",
    scientificName: "Canis familiaris",
    family: "epitelios",
    molecularMarker: "Can f 1",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 8.0,
    injectedDoseUg: 4.0,
    isPerennial: true,
    isProteolytic: false,
    bibliographyRef: "Consenso general epitelios EAACI (sin cita específica)",
    referenceVerified: false,
  },

  // ── Hongos ─────────────────────────────────────────────────────────────
  {
    id: "alternaria",
    name: "Hongo (Alternaria)",
    scientificName: "Alternaria alternata",
    family: "hongos",
    molecularMarker: "Alt a 1",
    commercialEquivalence: "4.0 μg/mL (Molecular)",
    vialConcentrationUgMl: 4.0,
    injectedDoseUg: 2.0,
    isPerennial: true,
    isProteolytic: true,
    bibliographyRef: "Brindisi 2025 (PMID 40095008) — Modigoid Alt a1; 4 µg/mL = ficha",
    referenceVerified: false,
  },
  {
    id: "cladosporium",
    name: "Hongo (Cladosporium)",
    scientificName: "Cladosporium herbarum",
    family: "hongos",
    molecularMarker: "Cla h 8 (Mezcla)",
    commercialEquivalence: "Sin estandarización molecular",
    // No estandarizado molecularmente a nivel clínico aún
    vialConcentrationUgMl: 0,
    injectedDoseUg: 0,
    isPerennial: true,
    isProteolytic: true,
    bibliographyRef: "Abel-Fernández 2023 (PMID 37233293) — extractos fúngicos no estandarizados",
    referenceVerified: false,
  },
];

// ─── Lookup helpers ──────────────────────────────────────────────────────────

/** Buscar un alérgeno por su id */
export function getAllergenById(id: string): Allergen | undefined {
  return ALLERGENS_DB.find((a) => a.id === id);
}
