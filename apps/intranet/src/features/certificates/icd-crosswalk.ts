// Crosswalk CIE-10 ↔ CIE-11 (release WHO 2026-01) — lookups cargados bajo
// demanda (dynamic import) para no inflar el bundle inicial. Datos generados
// con scripts/gen-icd-maps.mjs desde el crosswalk oficial WHO.
//
// Caveat WHO: el mapeo NO es 1:1. `MapToOneCategory` elige el mejor único →
// tratar como equivalencia aproximada.

let icd11To10Cache: Record<string, string> | null = null;
let icd10To11Cache: Record<string, { c: string; t: string }> | null = null;

/** Pre-carga el mapa CIE-11→CIE-10 (para mostrar el equivalente). */
export async function loadIcd11To10(): Promise<void> {
  if (icd11To10Cache) return;
  const mod = await import("./data/icd11-to-icd10.json");
  icd11To10Cache = mod.default as Record<string, string>;
}

/** Pre-carga el mapa CIE-10→CIE-11 (para búsqueda dual por código viejo). */
export async function loadIcd10To11(): Promise<void> {
  if (icd10To11Cache) return;
  const mod = await import("./data/icd10-to-icd11.json");
  icd10To11Cache = mod.default as Record<string, { c: string; t: string }>;
}

/** Código CIE-10 equivalente a un código CIE-11 (si el mapa ya está cargado). */
export function cie10Equivalent(icd11Code: string): string | undefined {
  return icd11To10Cache?.[icd11Code];
}

/** Entrada CIE-11 {código, título} equivalente a un código CIE-10. */
export function cie11Equivalent(icd10Code: string): { c: string; t: string } | undefined {
  return icd10To11Cache?.[icd10Code.trim().toUpperCase()];
}
