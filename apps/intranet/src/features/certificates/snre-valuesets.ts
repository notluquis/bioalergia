// Value sets oficiales del SNRE (Sistema Nacional de Receta Electrónica, MINSAL),
// capturados de prescripcion-receta.minsal.cl/api/fhir/*. Listas estables basadas
// en SNOMED CT (Terminología Farmacéutica Chilena). Las usamos para estructurar
// la receta igual que la receta electrónica oficial. El catálogo de fármacos
// (Semantikos) sí está gateado tras login SNRE → ese es proyecto FHIR aparte.

export type CodeDisplay = { code: string; display: string };

// Formas/unidades de dosis (drug-forms) — `doseFormat`/`quantityCode` en SNRE.
// Display optimizado para componer ("10 mg", "1 comprimido").
export const SNRE_DRUG_FORMS: CodeDisplay[] = [
  { code: "comprimido", display: "comprimido" },
  { code: "capsula", display: "cápsula" },
  { code: "miligramo", display: "mg" },
  { code: "gramo", display: "g" },
  { code: "microgramo", display: "mcg" },
  { code: "mililitro", display: "ml" },
  { code: "gotas", display: "gotas" },
  { code: "puff", display: "puff" },
  { code: "unidades", display: "unidades" },
  { code: "unidades-internacionales", display: "UI" },
  { code: "miliequivalente", display: "mEq" },
  { code: "ampolla", display: "ampolla" },
  { code: "vial", display: "vial" },
  { code: "jeringa-prellenada", display: "jeringa prellenada" },
  { code: "sobre", display: "sobre" },
  { code: "supositorio", display: "supositorio" },
  { code: "ovulo", display: "óvulo" },
  { code: "parche", display: "parche" },
  { code: "aplicacion", display: "aplicación" },
  { code: "aposito", display: "apósito" },
  { code: "implante", display: "implante" },
  { code: "anillo-vaginal", display: "anillo vaginal" },
  { code: "capsula-vaginal", display: "cápsula vaginal" },
  { code: "chicle", display: "chicle" },
  { code: "dispositivo", display: "dispositivo" },
  { code: "dosis", display: "dosis" },
  { code: "nanogramo", display: "ng" },
];

// Vías de administración (route-codes) — `administrationUse` en SNRE.
export const SNRE_ROUTES: CodeDisplay[] = [
  { code: "oral", display: "oral" },
  { code: "sublingual", display: "sublingual" },
  { code: "bucal", display: "bucal" },
  { code: "topica", display: "tópica" },
  { code: "transdermica", display: "transdérmica" },
  { code: "inhalatoria oral", display: "inhalatoria oral" },
  { code: "inhalatoria nasal", display: "inhalatoria nasal" },
  { code: "endonasal", display: "endonasal" },
  { code: "nebulizacion", display: "nebulización" },
  { code: "ocular", display: "ocular" },
  { code: "otica", display: "ótica" },
  { code: "rectal", display: "rectal" },
  { code: "vaginal", display: "vaginal" },
  { code: "intramuscular", display: "intramuscular" },
  { code: "subcutanea", display: "subcutánea" },
  { code: "intradermica", display: "intradérmica" },
  { code: "intravenosa", display: "intravenosa" },
  { code: "intraarterial", display: "intraarterial" },
  { code: "intraarticular", display: "intraarticular" },
  { code: "intratecal", display: "intratecal" },
  { code: "epidural", display: "epidural" },
  { code: "intravitrea", display: "intravítrea" },
  { code: "sonda nasogastrica", display: "sonda nasogástrica" },
];

// Unidades de tiempo (units-of-time) — para frecuencia y duración. Plural para
// componer ("cada 8 horas", "por 7 días").
export const SNRE_TIME_UNITS: CodeDisplay[] = [
  { code: "h", display: "horas" },
  { code: "d", display: "días" },
  { code: "wk", display: "semanas" },
  { code: "mo", display: "meses" },
  { code: "min", display: "minutos" },
  { code: "a", display: "años" },
];

const byCode = (list: CodeDisplay[]): Record<string, string> =>
  Object.fromEntries(list.map((x) => [x.code, x.display]));

export const SNRE_DRUG_FORM_LABEL = byCode(SNRE_DRUG_FORMS);
export const SNRE_ROUTE_LABEL = byCode(SNRE_ROUTES);
export const SNRE_TIME_UNIT_LABEL = byCode(SNRE_TIME_UNITS);
