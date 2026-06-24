// Calendario estacional de GRAMÍNEAS para Concepción / centro-sur de Chile.
//
// SOLO gramíneas: la Google Pollen API en Chile (código CL) únicamente entrega el
// tipo agregado GRASS (familia Poaceae), no árboles ni malezas, y no existe una
// estación aerobiológica local que los mida (polenes.cl no cubre el Biobío y está
// fuera de servicio). Por eso NO publicamos niveles de árboles/malezas: no hay un
// dato exacto que respaldarlos.
//
// Este calendario es solo un FALLBACK cualitativo para cuando el pronóstico en
// vivo de Google no esté disponible. Estacionalidad (hemisferio sur): las
// gramíneas del sur (Pooideae: ballica, pasto ovillo, pasto miel, Poa) polinizan
// de septiembre a marzo, con peak práctico nov–ene. Índice por mes 1–12.

import type { PollenCalendarTaxon, PollenLevel } from "@finanzas/orpc-contracts/pollen";

type TaxonDef = {
  type: "GRASS";
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
    type: "GRASS",
    label: "Gramíneas (pastos)",
    examples: ["Ballica (Lolium)", "Pasto ovillo (Dactylis)", "Pasto miel (Holcus)", "Poa"],
    //         E  F  M  A  M  J  J  A  S  O  N  D
    byMonth: [A, M, B, B, N, N, N, M, A, A, A, A],
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
