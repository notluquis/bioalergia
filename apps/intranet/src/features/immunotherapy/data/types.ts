// ─── Enums & Literal Types ───────────────────────────────────────────────────

/** Familias de alérgenos con sus propiedades clínicas */
export type AllergenFamily =
  | "acaros"
  | "gramineas"
  | "arboles"
  | "malezas"
  | "epitelios"
  | "hongos";

/** Laboratorio fabricante */
export type Provider = "inmunotek" | "roxall" | "diater";

/** Formulaciones comerciales de SCIT disponibles en Chile */
export type FormulationType =
  | "ESTANDAR" // 10.000 UT/mL — monosensibilización o vial individual
  | "FORTE" // 30.000 UT/mL — monosensibilización alta concentración
  | "MAX" // Carga antigénica completa por alérgeno en mezcla (simétrico)
  | "MODIGOID" // Alergoide molecular (Alt a 1) — solo Alternaria
  // ⛔ MAX FORTE eliminado — no se importa a Chile
  | "MOL" // Diater: Molecular puro (Alt a 1 MOL, Cup a 1 MOL, MOLMite)
  | "MOL_MIX" // Diater: Molecular + Polimerizado (MOLMite Mix)
  | "POLYMERIZED" // Diater: Alergoide polimerizado (hasta 5)
  | "POLYMERIZED_100" // Diater: Alergoide polimerizado dosis óptima (2-3)
  | "DEPOT" // Diater: Extracto nativo con aluminio
  | "LYOPHILISED"; // Diater: Extracto nativo liofilizado

/** Sitio de inyección recomendado */
export type InjectionSite = "brazo_derecho" | "brazo_izquierdo";

/** Nivel de severidad de alertas clínicas */
export type AlertSeverity = "info" | "warning" | "danger";

/** Modo de relevancia clínica entre alérgenos */
export type ClinicalRelevanceMode =
  | "equal" // Igual severidad → MAX simétrico
  | "dominant_split" // Uno dominante → separar en 2 viales Estándar
  | "dominant_max"; // Uno dominante → pero usar MAX simétrico de todas formas

// ─── Database Entity ─────────────────────────────────────────────────────────

/**
 * Alérgeno aeroalergénico para la calculadora SCIT.
 *
 * MODELO DE DOSIS (verificado 2026-06-15 contra papers + SmPC reales):
 * cada laboratorio usa su PROPIA unidad y no son convertibles entre sí.
 *  - Inmunotek / Roxall polimerizados: SOLO Unidades Terapéuticas (UT/TU).
 *    NO existe cifra µg de aeroalérgeno en sus fichas. La calculadora muestra UT.
 *  - Roxall Modigoid (alergoide molecular Alt a 1): µg reales (ficha §2 + Brindisi).
 *  - Diater moleculares: µg/mL reales por SmPC. Polimerizados Diater usan HEPD.
 * Por eso NO hay un único `injectedDoseUg` compartido entre proveedores.
 */
export interface Allergen {
  /** Identificador único (slug) */
  id: string;
  /** Nombre para display en español */
  name: string;
  /** Nombre científico en cursiva */
  scientificName: string;
  /** Familia taxonómica */
  family: AllergenFamily;
  /** Marcador molecular (proteína mayor) */
  molecularMarker: string;
  /** Etiqueta comercial estándar para polimerizados Inmunotek/Roxall (UT/TU). */
  utLabel: string;
  /**
   * Para alérgenos-MEZCLA vendidos como UN solo slot (Dpt+Df = "mezcla ácaros"):
   * las especies que comparten la concentración del slot. El UT del slot se
   * REPARTE entre ellas (ej. 10.000 UT → 5.000 UT por especie). undefined = una
   * sola especie (ocupa el slot completo). La mezcla cuenta como 1 de los máx 3.
   */
  componentLabels?: string[];
  /** true = presente todo el año (ácaros, epitelios, hongos) */
  isPerennial: boolean;
  /** true = produce enzimas proteolíticas (Alternaria, Cladosporium) */
  isProteolytic: boolean;
  /**
   * µg/mL de proteína mayor del alergoide MOLECULAR Roxall Modigoid, cuando
   * aplica (Alt a 1 = 4.0). Verificado: ficha Modigoid §2 + Brindisi 2025/2023.
   */
  modigoidUgPerMl?: number;
  /**
   * µg/mL del producto MOLECULAR Diater (vial B mantención, SmPC), cuando existe
   * (Alt a 1 0.46; Cup a 1 3.0; Der p 1 0.25). Los polimerizados Diater usan HEPD.
   */
  diaterMolecularUgPerMl?: number;
  /** Cita de respaldo verificada (PMID/ficha verbatim). */
  bibliographyRef: string;
}

// ─── Rules Engine Output ─────────────────────────────────────────────────────

/** Un alérgeno dentro de un vial con su dosis calculada */
export interface VialAllergenEntry {
  allergen: Allergen;
  /**
   * Dosis ya formateada con la unidad CORRECTA del producto:
   * "5.000 UT" (Inmunotek/Roxall), "2,0 µg" (Modigoid), "0,46 µg/mL molecular"
   * (Diater molecular), "HEPD" (polimerizado Diater), "Según ficha" (sin cifra).
   */
  doseDisplay: string;
  /**
   * µg de proteína mayor inyectados, SOLO cuando hay una cifra µg verificada que
   * cae bajo la ventana terapéutica convencional (Modigoid). undefined para UT,
   * HEPD, molecular Diater (paradigma de baja dosis, exento de la ventana 5–20 µg).
   */
  injectedUg?: number;
  /** Fuente verbatim de la cifra de dosis (tooltip). */
  doseSource?: string;
  /** true si este alérgeno fue marcado como dominante por el médico */
  isDominant: boolean;
}

/** Alternativa de presentación para alcanzar la dosis objetivo */
export interface InjectionEquivalence {
  /** Nombre de la presentación (ej. "Clustoid Normal", "Clustoid FORTE") */
  formulationName: string;
  /** Concentración del frasco comercial (ej. "10.000 UT/mL") */
  concentrationString: string;
  /** Volumen requerido a inyectar (mL) */
  requiredVolumeMl: number;
  /** Número matemático de dosis que rinde el vial de 2.5mL a granel */
  dosesPerVial: number;
}

/** Representación de un frasco/vial */
export interface Vial {
  /** Número de vial (1-based) */
  vialNumber: number;
  /** Etiqueta descriptiva (ej. "Perennes", "Estacionales", "Alternaria") */
  label: string;
  /** Formulación asignada */
  formulation: FormulationType;
  /** Alérgenos contenidos con sus dosis */
  allergens: VialAllergenEntry[];
  /** Volumen de inyección recomendado por defecto (mL) */
  injectionVolumeMl: number;
  /** Sitio de inyección recomendado */
  injectionSite: InjectionSite;
  /** Justificación clínica (tooltip) */
  rationale: string;
  /** Alternativas de inyección basadas en las presentaciones disponibles */
  equivalences?: InjectionEquivalence[];
}

/** Alerta/advertencia generada por el motor de reglas */
export interface ClinicalAlert {
  severity: AlertSeverity;
  /** Regla que la disparó */
  ruleTriggered: string;
  /** Mensaje para el médico */
  message: string;
}

/** Resultado completo del cálculo */
export interface ScitCalculationResult {
  /** Viales generados */
  vials: Vial[];
  /** Alertas clínicas */
  alerts: ClinicalAlert[];
  /** Regla(s) aplicada(s) */
  rulesApplied: string[];
  /** Resumen textual del cálculo */
  summary: string;
}

// ─── UI Input ────────────────────────────────────────────────────────────────

/** Selección completa del médico */
export interface DoctorSelection {
  /** IDs de alérgenos seleccionados */
  selectedAllergenIds: string[];
  /** Laboratorio elegido por el usuario */
  provider: Provider;
  /** Modo de relevancia (solo si N=2 o N=3 no-proteolíticos) */
  relevanceMode?: ClinicalRelevanceMode;
  /** ID del alérgeno dominante (solo si relevanceMode='dominant_split' o 'dominant_max') */
  dominantAllergenId?: string;
}

// ─── UI Helpers ──────────────────────────────────────────────────────────────

/** Etiquetas en español para cada familia */
export const FAMILY_LABELS: Record<AllergenFamily, string> = {
  acaros: "Ácaros",
  gramineas: "Gramíneas",
  arboles: "Árboles",
  malezas: "Malezas",
  epitelios: "Epitelios",
  hongos: "Hongos",
};

/** Colores HeroUI Chip para cada familia */
export const FAMILY_CHIP_COLORS: Record<
  AllergenFamily,
  "default" | "accent" | "danger" | "success" | "warning"
> = {
  acaros: "accent",
  gramineas: "success",
  arboles: "default",
  malezas: "warning",
  epitelios: "accent",
  hongos: "danger",
};

export const FORMULATION_CHIP_COLORS: Record<
  FormulationType,
  "default" | "accent" | "danger" | "success" | "warning"
> = {
  ESTANDAR: "default",
  FORTE: "warning",
  MAX: "accent",
  MODIGOID: "danger",
  MOL: "accent",
  MOL_MIX: "warning",
  POLYMERIZED: "default",
  POLYMERIZED_100: "success",
  DEPOT: "default",
  LYOPHILISED: "default",
};

/** Etiquetas en español para cada formulación */
export const FORMULATION_LABELS: Record<FormulationType, string> = {
  ESTANDAR: "Estándar",
  FORTE: "FORTE",
  MAX: "MAX",
  MODIGOID: "Modigoid",
  MOL: "MOL",
  MOL_MIX: "MOL Mix",
  POLYMERIZED: "Polymerized",
  POLYMERIZED_100: "Polymerized 100",
  DEPOT: "Depot",
  LYOPHILISED: "Lyophilised",
};
