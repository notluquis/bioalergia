import type { JobPostingDTO } from "@finanzas/orpc-contracts/job-radar";

export interface NormalizedJobLocation {
  raw: string | null;
  normalized: boolean;
  label: string;
  filterKeys: string[];
}

export interface LocationFilterOption {
  key: string;
  label: string;
}

const REGION_ALIAS_PAIRS: Array<[string, string]> = [
  ["metropolitana", "Región Metropolitana"],
  ["metropolitana de santiago", "Región Metropolitana"],
  ["region metropolitana", "Región Metropolitana"],
  ["region metropolitana de santiago", "Región Metropolitana"],
  ["valparaiso", "Valparaíso"],
  ["biobio", "Biobío"],
  ["bio bio", "Biobío"],
  ["bíobío", "Biobío"],
  ["araucania", "La Araucanía"],
  ["la araucania", "La Araucanía"],
  ["ohiggins", "O'Higgins"],
  ["o higgins", "O'Higgins"],
  ["lib gral bdo o higgins", "O'Higgins"],
  ["libertador b o higgins", "O'Higgins"],
  ["libertador bernardo o higgins", "O'Higgins"],
  ["nuble", "Ñuble"],
  ["los rios", "Los Ríos"],
  ["los lagos", "Los Lagos"],
  ["aysen", "Aysén"],
  ["magallanes", "Magallanes"],
  ["magallanes y antartica chilena", "Magallanes"],
  ["arica y parinacota", "Arica y Parinacota"],
];

const REGION_ALIASES = new Map<string, string>(
  REGION_ALIAS_PAIRS.map(([alias, region]) => [norm(alias), region])
);

const DIRECT_REGIONS = [
  "Antofagasta",
  "Atacama",
  "Coquimbo",
  "Maule",
  "Tarapacá",
  "Valparaíso",
  "Biobío",
  "Ñuble",
  "Los Lagos",
  "Los Ríos",
  "O'Higgins",
  "Aysén",
  "Magallanes",
  "La Araucanía",
  "Arica y Parinacota",
];

for (const region of DIRECT_REGIONS) REGION_ALIASES.set(norm(region), region);

const COMMUNE_ALIASES = new Map(
  [
    "Cerrillos",
    "Cerro Navia",
    "Conchalí",
    "El Bosque",
    "Estación Central",
    "Huechuraba",
    "Independencia",
    "La Cisterna",
    "La Florida",
    "La Granja",
    "La Pintana",
    "La Reina",
    "Las Condes",
    "Lo Barnechea",
    "Lo Espejo",
    "Lo Prado",
    "Macul",
    "Maipú",
    "Ñuñoa",
    "Pedro Aguirre Cerda",
    "Peñalolén",
    "Providencia",
    "Pudahuel",
    "Quilicura",
    "Quinta Normal",
    "Recoleta",
    "Renca",
    "San Joaquín",
    "San Miguel",
    "San Ramón",
    "Santiago",
    "Vitacura",
    "Puente Alto",
    "San Bernardo",
    "Concepción",
    "Talcahuano",
    "Chiguayante",
    "Hualpén",
    "Penco",
    "San Pedro de la Paz",
    "Coronel",
    "Lota",
    "Tomé",
    "Hualqui",
    "Valparaíso",
    "Viña del Mar",
    "Concón",
    "Quilpué",
    "Villa Alemana",
    "Antofagasta",
    "Calama",
    "La Serena",
    "Coquimbo",
    "Rancagua",
    "Talca",
    "Chillán",
    "Temuco",
    "Puerto Montt",
    "Valdivia",
    "Osorno",
    "Copiapó",
    "Iquique",
    "Arica",
    "Punta Arenas",
  ].map((name) => [norm(name), name])
);

COMMUNE_ALIASES.set(norm("Concepcion"), "Concepción");
COMMUNE_ALIASES.set(norm("Vina del Mar"), "Viña del Mar");
COMMUNE_ALIASES.set(norm("Maipu"), "Maipú");
COMMUNE_ALIASES.set(norm("Nunoa"), "Ñuñoa");

const COMMUNE_REGION: Record<string, string> = {
  Antofagasta: "Antofagasta",
  Arica: "Arica y Parinacota",
  Calama: "Antofagasta",
  Chillán: "Ñuble",
  Concepción: "Biobío",
  Coquimbo: "Coquimbo",
  Copiapó: "Atacama",
  Iquique: "Tarapacá",
  "La Serena": "Coquimbo",
  Osorno: "Los Lagos",
  "Puerto Montt": "Los Lagos",
  "Punta Arenas": "Magallanes",
  Rancagua: "O'Higgins",
  Talca: "Maule",
  Temuco: "La Araucanía",
  Valdivia: "Los Ríos",
  Valparaíso: "Valparaíso",
  "Viña del Mar": "Valparaíso",
};

const GRAN_SANTIAGO = new Set([
  "Cerrillos",
  "Cerro Navia",
  "Conchalí",
  "El Bosque",
  "Estación Central",
  "Huechuraba",
  "Independencia",
  "La Cisterna",
  "La Florida",
  "La Granja",
  "La Pintana",
  "La Reina",
  "Las Condes",
  "Lo Barnechea",
  "Lo Espejo",
  "Lo Prado",
  "Macul",
  "Maipú",
  "Ñuñoa",
  "Pedro Aguirre Cerda",
  "Peñalolén",
  "Providencia",
  "Pudahuel",
  "Quilicura",
  "Quinta Normal",
  "Recoleta",
  "Renca",
  "San Joaquín",
  "San Miguel",
  "San Ramón",
  "Santiago",
  "Vitacura",
  "Puente Alto",
  "San Bernardo",
]);

const GRAN_CONCEPCION = new Set([
  "Concepción",
  "Talcahuano",
  "Chiguayante",
  "Hualpén",
  "Penco",
  "San Pedro de la Paz",
  "Coronel",
  "Lota",
  "Tomé",
  "Hualqui",
]);

const GRAN_VALPARAISO = new Set([
  "Valparaíso",
  "Viña del Mar",
  "Concón",
  "Quilpué",
  "Villa Alemana",
]);

function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function key(kind: string, value: string): string {
  return `${kind}:${norm(value)}`;
}

function displayParts(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => {
      const n = norm(part);
      return n.length > 0 && n !== "cl" && n !== "chile";
    });
}

function findCommune(parts: string[], normalizedRaw: string): string | null {
  for (const part of parts) {
    const direct = COMMUNE_ALIASES.get(norm(part));
    if (direct) return direct;
  }
  for (const [alias, commune] of COMMUNE_ALIASES) {
    if (normalizedRaw.includes(alias)) return commune;
  }
  return null;
}

function findRegion(parts: string[], commune: string | null): string | null {
  for (const part of parts) {
    const region = REGION_ALIASES.get(norm(part));
    if (region) return region;
  }
  if (commune) {
    const region = COMMUNE_REGION[commune];
    if (region) return region;
  }
  if (commune && GRAN_SANTIAGO.has(commune)) return "Región Metropolitana";
  if (commune && GRAN_CONCEPCION.has(commune)) return "Biobío";
  if (commune && GRAN_VALPARAISO.has(commune)) return "Valparaíso";
  return null;
}

export function normalizeJobLocation(raw: string | null): NormalizedJobLocation {
  if (!raw) return { raw, normalized: false, label: "Sin ubicación", filterKeys: ["missing"] };

  const parts = displayParts(raw);
  const normalizedRaw = norm(raw);
  const commune = findCommune(parts, normalizedRaw);
  const region = findRegion(parts, commune);
  const filterKeys: string[] = [];

  if (commune) filterKeys.push(key("commune", commune));
  if (region) filterKeys.push(key("region", region));
  if (commune && GRAN_SANTIAGO.has(commune)) filterKeys.push("zone:gran-santiago");
  if (commune && GRAN_CONCEPCION.has(commune)) filterKeys.push("zone:gran-concepcion");
  if (commune && GRAN_VALPARAISO.has(commune)) filterKeys.push("zone:gran-valparaiso");

  if (filterKeys.length === 0)
    return { raw, normalized: false, label: raw, filterKeys: ["unnormalized"] };
  return {
    raw,
    normalized: true,
    label: commune && region ? `${commune}, ${region}` : (commune ?? region ?? raw),
    filterKeys,
  };
}

export function buildLocationFilterOptions(rows: JobPostingDTO[]): LocationFilterOption[] {
  const options = new Map<string, string>();
  options.set("zone:gran-santiago", "Gran Santiago");
  options.set("zone:gran-concepcion", "Gran Concepción");
  options.set("zone:gran-valparaiso", "Gran Valparaíso");

  for (const row of rows) {
    const location = normalizeJobLocation(row.location);
    for (const filterKey of location.filterKeys) {
      if (filterKey === "missing") options.set(filterKey, "Sin ubicación");
      else if (filterKey === "unnormalized") options.set(filterKey, "No normalizada");
      else if (filterKey.startsWith("region:"))
        options.set(filterKey, location.label.split(", ").at(-1) ?? location.label);
      else if (filterKey.startsWith("commune:")) options.set(filterKey, location.label);
    }
  }

  return [...options.entries()]
    .map(([optionKey, label]) => ({ key: optionKey, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function matchesLocationFilter(row: JobPostingDTO, filterKey: string): boolean {
  if (filterKey === "ALL") return true;
  return normalizeJobLocation(row.location).filterKeys.includes(filterKey);
}
