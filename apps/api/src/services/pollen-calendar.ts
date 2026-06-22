// Calendario polínico curado para Concepción / Biobío (hemisferio sur).
// NO hay sensor aerobiológico local (polenes.cl llega a Talca; SINCA mide PM,
// no polen) ni la Google Pollen API entrega árboles/malezas en Chile, así que el
// nivel de árboles/malezas/gramíneas es una ESTIMACIÓN estacional cualitativa.
// Fuente: literatura aerobiológica chilena (estudio Temuco; calendarios clínicos
// Clínica Alemana). PENDIENTE validación del alergólogo antes de publicar.
//
// Estacionalidad (hemisferio sur): árboles ago–oct; gramíneas sep–ene; malezas
// nov–feb. Índice por mes 1–12.

import type { PollenCalendarTaxon, PollenLevel } from "@finanzas/orpc-contracts/pollen";

type TaxonDef = {
  type: "GRASS" | "TREE" | "WEED";
  label: string;
  examples: string[];
  // Nivel por mes (índice 0 = enero … 11 = diciembre).
  byMonth: PollenLevel[];
};

const A: PollenLevel = "alto";
const M: PollenLevel = "medio";
const B: PollenLevel = "bajo";
const N: PollenLevel = "nulo";

const TAXA: TaxonDef[] = [
  {
    type: "TREE",
    label: "Árboles",
    examples: ["Plátano oriental", "Ciprés", "Álamo", "Fresno"],
    //         E  F  M  A  M  J  J  A  S  O  N  D
    byMonth: [B, N, N, B, B, B, M, A, A, A, M, B],
  },
  {
    type: "GRASS",
    label: "Gramíneas (pastos)",
    examples: ["Ballica", "Pasto bermuda", "Pasto Timothy", "Poa"],
    //         E  F  M  A  M  J  J  A  S  O  N  D
    byMonth: [A, M, B, B, N, N, N, M, A, A, A, A],
  },
  {
    type: "WEED",
    label: "Malezas",
    examples: ["Romaza (Rumex)", "Llantén (Plantago)", "Artemisa", "Cenizo"],
    //         E  F  M  A  M  J  J  A  S  O  N  D
    byMonth: [A, A, M, B, N, N, N, N, B, M, A, A],
  },
];

/** Calendario polínico para un mes (1–12). `inSeason` = nivel medio o alto. */
export function pollenCalendarForMonth(month: number): PollenCalendarTaxon[] {
  const idx = Math.min(11, Math.max(0, month - 1));
  return TAXA.map((t) => {
    const level = t.byMonth[idx] ?? "nulo";
    return {
      type: t.type,
      label: t.label,
      level,
      inSeason: level === "medio" || level === "alto",
      examples: t.examples,
    };
  });
}
