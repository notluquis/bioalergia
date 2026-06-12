import type { Allergen, AllergenFamily } from "./types";

/** Familias consideradas perennes (presentes todo el año) */
export const PERENNIAL_FAMILIES: ReadonlySet<AllergenFamily> = new Set([
  "acaros",
  "epitelios",
  "hongos",
]);

/** Familias consideradas estacionales */
export const SEASONAL_FAMILIES: ReadonlySet<AllergenFamily> = new Set([
  "gramineas",
  "arboles",
  "malezas",
]);

/**
 * Matriz de Equivalencias Moleculares — Fuente de la Verdad
 *
 * Extraída de 07_CALCULADORA_DOSIS_SCIT.md
 * Concentraciones basadas en mantenimiento estándar (10.000 UT/mL) salvo excepciones.
 * Dosis inyectada = concentración × 0.5 mL.
 * Ventana terapéutica EAACI: 5–20 μg por inyección.
 */
export const ALLERGENS_DB: readonly Allergen[] = [
  // ─── Ácaros ────────────────────────────────────────────────────────────────
  {
    id: "dpt-df",
    name: "Dermatophagoides (Dpt/Df)",
    scientificName: "Dermatophagoides pteronyssinus / farinae",
    family: "acaros",
    molecularMarker: "Der p 1 + Der f 1",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 16.6,
    injectedDoseUg: 8.3,
    isPerennial: true,
    isProteolytic: false,
    bibliographyRef: "[1] Nieto et al., 2022",
  },
  {
    id: "blomia",
    name: "Blomia tropicalis",
    scientificName: "Blomia tropicalis",
    family: "acaros",
    molecularMarker: "Blo t 5",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 15.0,
    injectedDoseUg: 7.5,
    isPerennial: true,
    isProteolytic: false,
    bibliographyRef: "Extrapolación de línea PM-HDM",
  },

  // ─── Gramíneas ─────────────────────────────────────────────────────────────
  {
    id: "gramineas",
    name: "Gramíneas (Mezcla)",
    scientificName: "Phleum, Dactylis, Lolium, etc.",
    family: "gramineas",
    molecularMarker: "Grupo 1 + Grupo 5",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 24.0,
    injectedDoseUg: 12.0,
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "[2] Klimek et al., 2014",
  },

  // ─── Árboles ───────────────────────────────────────────────────────────────
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
    bibliographyRef: "Literatura interna Inmunotek",
  },
  {
    id: "abedul",
    name: "Abedul",
    scientificName: "Betula verrucosa",
    family: "arboles",
    molecularMarker: "Bet v 1",
    commercialEquivalence: "23.000 mTU/mL (T502)",
    vialConcentrationUgMl: 35.0,
    injectedDoseUg: 17.5,
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "[3] Pfaar et al., 2023",
  },
  {
    id: "platano",
    name: "Plátano oriental",
    scientificName: "Platanus",
    family: "arboles",
    molecularMarker: "Pla a 1",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 15.0,
    injectedDoseUg: 7.5,
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "Ficha Alxoid/Clustoid",
  },
  {
    id: "cipres",
    name: "Ciprés",
    scientificName: "Cupressus",
    family: "arboles",
    molecularMarker: "Cup a 1",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 12.0,
    injectedDoseUg: 6.0,
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "Ficha Alxoid/Clustoid",
  },

  // ─── Malezas ───────────────────────────────────────────────────────────────
  {
    id: "ambrosia",
    name: "Ambrosía (Ragweed)",
    scientificName: "Ambrosia",
    family: "malezas",
    molecularMarker: "Amb a 1",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 10.0,
    injectedDoseUg: 5.0,
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "[4] PMID:38932364 (2024)",
  },
  {
    id: "parietaria",
    name: "Parietaria",
    scientificName: "Parietaria",
    family: "malezas",
    molecularMarker: "Par j 1 + Par j 2",
    commercialEquivalence: "10.000 UT/mL",
    vialConcentrationUgMl: 14.0,
    injectedDoseUg: 7.0,
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "Ficha Alxoid/Clustoid",
  },

  // ─── Epitelios ─────────────────────────────────────────────────────────────
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
    bibliographyRef: "Evidencia general epitelios",
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
    bibliographyRef: "Evidencia general epitelios",
  },

  // ─── Hongos ────────────────────────────────────────────────────────────────
  {
    id: "alternaria",
    name: "Alternaria",
    scientificName: "Alternaria alternata",
    family: "hongos",
    molecularMarker: "Alt a 1",
    commercialEquivalence: "Modigoid Molecular",
    vialConcentrationUgMl: 4.0,
    injectedDoseUg: 2.0,
    isPerennial: true,
    isProteolytic: true,
    bibliographyRef: "[5] PMID:40095008 (2025)",
  },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Busca un alérgeno por su ID. */
export function getAllergenById(id: string): Allergen | undefined {
  return ALLERGENS_DB.find((a) => a.id === id);
}

/** Filtra alérgenos por familia. */
export function getAllergensByFamily(family: AllergenFamily): Allergen[] {
  return ALLERGENS_DB.filter((a) => a.family === family);
}

/** Volumen estándar de inyección SCIT (mL). */
export const INJECTION_VOLUME_ML = 0.5;

/** Concentración estándar comercial (UT/mL). */
export const STANDARD_CONCENTRATION_UT_ML = 10_000;
