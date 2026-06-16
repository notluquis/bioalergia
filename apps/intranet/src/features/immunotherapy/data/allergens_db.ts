import type { Allergen, AllergenFamily } from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// NOTA DE VERIFICACIÓN BIBLIOGRÁFICA (2026-06-15)
// ───────────────────────────────────────────────────────────────────────────
// Datos cotejados contra los papers y SmPC reales del directorio de proveedores
// (.../proveedores/{inmunotek,roxall,diater_espana}/). Conclusiones:
//
//  • Inmunotek y Roxall (polimerizados) NO dosifican aeroalérgenos en µg: solo
//    en UT/TU (unidad de potencia biológica). NINGUNA ficha de aeroalérgeno trae
//    µg. Por eso la calculadora muestra UT para estos productos, no µg.
//  • Las cifras µg previas (Der p 8.3, gramíneas 12, abedul 17.5, ambrosia 5)
//    eran inválidas: 8.3 era el valor POR mL de un producto de investigación
//    (Nieto 2022, PM-HDM), abedul y ambrosia eran INVENTADAS, y gramíneas 24 µg/mL
//    es de Klimek 2014 = Clustoid de ROXALL, grupo 1+5 combinados. ELIMINADAS.
//  • µg REALES y verificados (verbatim):
//      - Roxall Modigoid Alt a 1: 4.0 µg/mL → 2.0 µg/0.5 mL (ficha §2 + Brindisi
//        2025/2023). Cup a 1 Modigoid = 12 µg/mL.
//      - Diater molecular (SmPC vial B mantención): Der p 1 0.25; Alt a 1 0.46;
//        Cup a 1 3.0 µg/mL. Polimerizados Diater = HEPD (sin µg).
//  • Cladosporium: SIN producto molecular/estandarizado en ningún proveedor
//    (solo extracto nativo TSU). Dosis NO calculable → se aísla y se advierte.
//  • Racional de aislar Alternaria: el documentado en las fuentes es ESTRUCTURAL
//    (Alt a 1 dímero ββ-barrel, epítopos IgE), NO "proteasas que degradan". Texto
//    corregido en el motor.
//  • Ancla de seguridad VERIFICADA: ventana 5–20 µg de alérgeno mayor por
//    inyección para extractos CONVENCIONALES (PMID 29631326). Los alergoides
//    moleculares (Modigoid, Diater molecular) usan un paradigma de baja dosis y
//    están exentos de esa ventana.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Constants ───────────────────────────────────────────────────────────────

/** Volumen de inyección estándar (mL) */
export const INJECTION_VOLUME_ML = 0.5;

/** Concentración estándar UT/mL para extractos polimerizados Inmunotek/Roxall. */
export const STANDARD_CONCENTRATION_UT_ML = 10_000;

/** Concentración FORTE UT/mL (monosensibilización alta concentración). */
export const FORTE_CONCENTRATION_UT_ML = 30_000;

/**
 * Ventana terapéutica de extractos CONVENCIONALES (µg de proteína mayor por
 * inyección). Verificado 5–20 µg (PMID 29631326), alineado con EAACI. Los
 * alergoides moleculares quedan exentos.
 */
export const THERAPEUTIC_WINDOW_MIN_UG = 5;
export const THERAPEUTIC_WINDOW_MAX_UG = 20;

/** Familias consideradas perennes para la separación en la Regla 4 */
export const PERENNIAL_FAMILIES: ReadonlySet<AllergenFamily> = new Set([
  "acaros",
  "epitelios",
  "hongos",
]);

// ─── Referencia bibliográfica por alérgeno (verificada 2026-06-15) ────────────

export interface AllergenReference {
  pmidOrSource: string;
  description: string;
}

/** Mapa de refs bibliográficas indexado por id de alérgeno. */
export const ALLERGEN_REFERENCES: Record<string, AllergenReference> = {
  acaro_dpt: {
    pmidOrSource: "Inmunotek/Roxall UT; Diater SmPC MOLMite",
    description:
      "Polimerizados dosificados en UT/TU (sin µg). Diater MOLMite vial B: Der p 1 0,25 µg/mL (SmPC).",
  },
  acaro_df: {
    pmidOrSource: "Inmunotek/Roxall UT",
    description: "D. farinae dosificado en UT/TU; sin cifra µg en ficha.",
  },
  acaro_bt: {
    pmidOrSource: "Inmunotek/Roxall UT; Diater polimerizado HEPD",
    description: "Blomia tropicalis: UT/TU; en Diater MOLMite Mix va como polimerizado (0,1 HEPD).",
  },
  gramineas_mix: {
    pmidOrSource: "Klimek 2014 (PMID 25130503) — Clustoid Roxall",
    description:
      "10.000 TU/mL = 24 µg grupo 1+5 COMBINADOS (no un marcador). Producto Roxall, no Inmunotek.",
  },
  olivo: {
    pmidOrSource: "Inmunotek/Roxall UT; Diater polimerizado HEPD",
    description: "Olea europaea: UT/TU; en Diater Mix va como polimerizado (0,77 HEPD).",
  },
  abedul: {
    pmidOrSource: "Sin cifra µg verificada",
    description:
      "Sin producto/ficha µg en el corpus. El único µg de abedul es LETI Depigoid (~300 µg/mL pre-depig, otro fabricante).",
  },
  platano_oriental: {
    pmidOrSource: "Inmunotek/Roxall UT",
    description: "Platanus: UT/TU; sin cifra µg en ficha.",
  },
  cipres: {
    pmidOrSource: "Inmunotek/Roxall UT; Diater Cup a 1 MOL SmPC",
    description: "Cupressus: UT/TU; Diater Cup a 1 MOL vial B = 3,0 µg/mL (SmPC).",
  },
  ambrosia: {
    pmidOrSource: "Sin cifra µg verificada",
    description: "Ambrosia: UT/TU; no hay cifra µg en ninguna fuente del corpus.",
  },
  parietaria: {
    pmidOrSource: "PMID 30326788 (2018) — Parietaria depot SCIT",
    description: "Tolerabilidad/eficacia de Parietaria judaica depot; sin cifra µg.",
  },
  gato: {
    pmidOrSource: "Inmunotek/Roxall UT",
    description: "Fel d 1: UT/TU; sin cifra µg en ficha.",
  },
  perro: {
    pmidOrSource: "Inmunotek/Roxall UT",
    description: "Can f 1: UT/TU; sin cifra µg en ficha.",
  },
  alternaria: {
    pmidOrSource: "Modigoid ficha §2 + Brindisi 2025 (PMID 40095008)",
    description:
      "Roxall Modigoid: 4,0 µg/mL Alt a 1 → 2,0 µg/0,5 mL (verbatim). Diater Alt a 1 MOL = 0,46 µg/mL (SmPC).",
  },
  cladosporium: {
    pmidOrSource: "Abel-Fernández 2023 (PMID 37233293)",
    description:
      "Extractos fúngicos insuficientemente estandarizados; sin producto molecular ni cifra µg.",
  },
};

// ─── Allergen Database ───────────────────────────────────────────────────────

/**
 * Base de datos de aeroalérgenos para la Calculadora SCIT.
 * La unidad de dosis depende del proveedor (ver nota arriba): el motor de reglas
 * (useScitCalculator) calcula la dosis con la unidad correcta por producto.
 */
export const ALLERGENS_DB: Allergen[] = [
  // ── Ácaros ─────────────────────────────────────────────────────────────
  {
    id: "acaro_dpt",
    name: "Ácaro del Polvo (Dpt)",
    scientificName: "Dermatophagoides pteronyssinus",
    family: "acaros",
    molecularMarker: "Der p 1 + Der p 2",
    catalogId: "alg_0006",
    utLabel: "10.000 UT/mL",
    isPerennial: true,
    isProteolytic: false,
    diaterMolecularUgPerMl: 0.25,
    bibliographyRef: "Inmunotek/Roxall UT; Diater SmPC MOLMite (Der p 1 0,25 µg/mL)",
  },
  {
    id: "acaro_df",
    name: "Ácaro del Polvo (Df)",
    scientificName: "Dermatophagoides farinae",
    family: "acaros",
    molecularMarker: "Der f 1 + Der f 2",
    catalogId: "alg_0004",
    utLabel: "10.000 UT/mL",
    isPerennial: true,
    isProteolytic: false,
    bibliographyRef: "Inmunotek/Roxall UT (sin cifra µg en ficha)",
  },
  {
    id: "acaro_bt",
    name: "Ácaro Tropical",
    scientificName: "Blomia tropicalis",
    family: "acaros",
    molecularMarker: "Blo t 5",
    catalogId: "alg_0003",
    utLabel: "10.000 UT/mL",
    isPerennial: true,
    isProteolytic: false,
    bibliographyRef: "Inmunotek/Roxall UT; Diater polimerizado (0,1 HEPD)",
  },
  {
    // Mezcla comercial Dpt+Df vendida como UN alérgeno (1 slot): el UT se reparte
    // entre las dos especies (10.000 UT → 5.000 UT c/u). Alternativa a elegir Dpt
    // y Df por separado (2 slots, 10.000 UT c/u en MAX/Poliplus).
    id: "mezcla_acaros",
    name: "Mezcla de Ácaros (Dpt + Df)",
    scientificName: "Dermatophagoides pteronyssinus + D. farinae",
    family: "acaros",
    molecularMarker: "Der p 1 + Der f 1",
    componentCatalogIds: ["alg_0006", "alg_0004"],
    utLabel: "10.000 UT/mL (mezcla)",
    componentLabels: ["Der p (Dpt)", "Der f (Df)"],
    isPerennial: true,
    isProteolytic: false,
    bibliographyRef: "Inmunotek/Roxall: mezcla Dpt+Df = 1 alérgeno (catálogo, verbatim)",
  },

  // ── Gramíneas ──────────────────────────────────────────────────────────
  {
    id: "gramineas_mix",
    name: "Mezcla de Gramíneas",
    scientificName: "Phleum pratense, Dactylis glomerata, etc.",
    family: "gramineas",
    molecularMarker: "Phl p 1 + Phl p 5",
    catalogId: "alg_grass_mix",
    utLabel: "10.000 UT/mL",
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "Klimek 2014 (PMID 25130503, Clustoid Roxall); UT",
  },

  // ── Árboles ────────────────────────────────────────────────────────────
  {
    id: "olivo",
    name: "Olivo",
    scientificName: "Olea europaea",
    family: "arboles",
    molecularMarker: "Ole e 1",
    catalogId: "alg_0053",
    utLabel: "10.000 UT/mL",
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "Inmunotek/Roxall UT; Diater polimerizado (0,77 HEPD)",
  },
  {
    id: "abedul",
    name: "Abedul",
    scientificName: "Betula verrucosa",
    family: "arboles",
    molecularMarker: "Bet v 1",
    catalogId: "alg_0044",
    utLabel: "10.000 UT/mL",
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "UT (sin cifra µg verificada en el corpus)",
  },
  {
    id: "platano_oriental",
    name: "Plátano Oriental",
    scientificName: "Platanus acerifolia",
    family: "arboles",
    molecularMarker: "Pla a 1",
    catalogId: "alg_0059",
    utLabel: "10.000 UT/mL",
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "Inmunotek/Roxall UT (sin cifra µg en ficha)",
  },
  {
    id: "cipres",
    name: "Ciprés",
    scientificName: "Cupressus arizonica / sempervirens",
    family: "arboles",
    molecularMarker: "Cup a 1",
    catalogId: "alg_0047",
    utLabel: "10.000 UT/mL",
    isPerennial: false,
    isProteolytic: false,
    diaterMolecularUgPerMl: 3.0,
    bibliographyRef: "Inmunotek/Roxall UT; Diater Cup a 1 MOL (3,0 µg/mL, SmPC)",
  },

  // ── Malezas ────────────────────────────────────────────────────────────
  {
    id: "ambrosia",
    name: "Ambrosia",
    scientificName: "Ambrosia artemisiifolia",
    family: "malezas",
    molecularMarker: "Amb a 1",
    catalogId: "alg_0072",
    utLabel: "10.000 UT/mL",
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "UT (sin cifra µg verificada)",
  },
  {
    id: "parietaria",
    name: "Parietaria",
    scientificName: "Parietaria judaica",
    family: "malezas",
    molecularMarker: "Par j 1 + Par j 2",
    catalogId: "alg_0083",
    utLabel: "10.000 UT/mL",
    isPerennial: false,
    isProteolytic: false,
    bibliographyRef: "PMID 30326788 (2018) Parietaria depot SCIT; UT",
  },

  // ── Epitelios ──────────────────────────────────────────────────────────
  {
    id: "gato",
    name: "Gato",
    scientificName: "Felis domesticus",
    family: "epitelios",
    molecularMarker: "Fel d 1",
    catalogId: "alg_0097",
    utLabel: "10.000 UT/mL",
    isPerennial: true,
    isProteolytic: false,
    bibliographyRef: "Inmunotek/Roxall UT (sin cifra µg en ficha)",
  },
  {
    id: "perro",
    name: "Perro",
    scientificName: "Canis familiaris",
    family: "epitelios",
    molecularMarker: "Can f 1",
    catalogId: "alg_0100",
    utLabel: "10.000 UT/mL",
    isPerennial: true,
    isProteolytic: false,
    bibliographyRef: "Inmunotek/Roxall UT (sin cifra µg en ficha)",
  },

  // ── Hongos ─────────────────────────────────────────────────────────────
  {
    id: "alternaria",
    name: "Hongo (Alternaria)",
    scientificName: "Alternaria alternata",
    family: "hongos",
    molecularMarker: "Alt a 1",
    catalogId: "alg_0010",
    utLabel: "Modigoid 4,0 µg/mL (Roxall)",
    isPerennial: true,
    isProteolytic: true,
    modigoidUgPerMl: 4.0,
    diaterMolecularUgPerMl: 0.46,
    bibliographyRef: "Modigoid ficha §2 + Brindisi 2025 (PMID 40095008); Diater 0,46 µg/mL",
  },
  {
    id: "cladosporium",
    name: "Hongo (Cladosporium)",
    scientificName: "Cladosporium herbarum",
    family: "hongos",
    molecularMarker: "Cla h 8 (Mezcla)",
    catalogId: "alg_0015",
    utLabel: "Sin estandarización molecular",
    isPerennial: true,
    isProteolytic: true,
    bibliographyRef: "Abel-Fernández 2023 (PMID 37233293) — no estandarizado",
  },
];

// ─── Lookup helpers ──────────────────────────────────────────────────────────

/** Buscar un alérgeno por su id */
export function getAllergenById(id: string): Allergen | undefined {
  return ALLERGENS_DB.find((a) => a.id === id);
}
