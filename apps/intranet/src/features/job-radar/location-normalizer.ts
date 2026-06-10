import type { JobPostingDTO } from "@finanzas/orpc-contracts/job-radar";

export interface NormalizedJobLocation {
  raw: string | null;
  normalized: boolean;
  label: string;
  filterKeys: string[];
}

export interface LocationFilterOption {
  group: "commune" | "country" | "region" | "review" | "zone";
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
    "Colina",
    "Castro",
    "Coyhaique",
    "Curicó",
    "Calbuco",
    "Chañaral",
    "Illapel",
    "Lampa",
    "Los Andes",
    "Punta Arenas",
    "Salamanca",
    "San Antonio",
    "San Vicente",
    "Santa Cruz",
    "Santa Bárbara",
  ].map((name) => [norm(name), name])
);

COMMUNE_ALIASES.set(norm("Concepcion"), "Concepción");
COMMUNE_ALIASES.set(norm("Vina del Mar"), "Viña del Mar");
COMMUNE_ALIASES.set(norm("Maipu"), "Maipú");
COMMUNE_ALIASES.set(norm("Nunoa"), "Ñuñoa");

const COMMUNE_REGION: Record<string, string> = {
  Antofagasta: "Antofagasta",
  Arica: "Arica y Parinacota",
  Calbuco: "Los Lagos",
  Calama: "Antofagasta",
  Castro: "Los Lagos",
  Chañaral: "Atacama",
  Chillán: "Ñuble",
  Colina: "Región Metropolitana",
  Concepción: "Biobío",
  Coquimbo: "Coquimbo",
  Coyhaique: "Aysén",
  Copiapó: "Atacama",
  Curicó: "Maule",
  Illapel: "Coquimbo",
  Iquique: "Tarapacá",
  "La Serena": "Coquimbo",
  Lampa: "Región Metropolitana",
  "Los Andes": "Valparaíso",
  Osorno: "Los Lagos",
  "Puerto Montt": "Los Lagos",
  "Punta Arenas": "Magallanes",
  Rancagua: "O'Higgins",
  Salamanca: "Coquimbo",
  "San Antonio": "Valparaíso",
  "San Vicente": "O'Higgins",
  "Santa Cruz": "O'Higgins",
  "Santa Bárbara": "Biobío",
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

const COUNTRY_ALIAS_PAIRS: Array<[string, string]> = [
  ["argentina", "Argentina"],
  ["buenos aires", "Argentina"],
  ["australia", "Australia"],
  ["auckland", "Nueva Zelanda"],
  ["bolivia", "Bolivia"],
  ["bangkok", "Tailandia"],
  ["bangalore", "India"],
  ["banglore", "India"],
  ["barcelona", "España"],
  ["belgium", "Bélgica"],
  ["benito juarez", "México"],
  ["brasil", "Brasil"],
  ["brussels", "Bélgica"],
  ["cancun", "México"],
  ["canada", "Canadá"],
  ["cavite", "Filipinas"],
  ["charlotte", "Estados Unidos"],
  ["chicago", "Estados Unidos"],
  ["chihuahua", "México"],
  ["china", "China"],
  ["bogota", "Colombia"],
  ["colombia", "Colombia"],
  ["cordoba", "Argentina"],
  ["costa rica", "Costa Rica"],
  ["curitiba", "Brasil"],
  ["dukem", "Etiopía"],
  ["dubai", "Emiratos Árabes Unidos"],
  ["ecuador", "Ecuador"],
  ["egypt", "Egipto"],
  ["el salvador", "El Salvador"],
  ["emiratos arabes unidos", "Emiratos Árabes Unidos"],
  ["espana", "España"],
  ["ethiopia", "Etiopía"],
  ["filipinas", "Filipinas"],
  ["france", "Francia"],
  ["guayaquil", "Ecuador"],
  ["hammond", "Estados Unidos"],
  ["heredia", "Costa Rica"],
  ["philippines", "Filipinas"],
  ["hoboken", "Estados Unidos"],
  ["india", "India"],
  ["indonesia", "Indonesia"],
  ["italy", "Italia"],
  ["japan", "Japón"],
  ["jeddah", "Arabia Saudita"],
  ["jefferson city", "Estados Unidos"],
  ["jonesboro", "Estados Unidos"],
  ["kings mountain", "Estados Unidos"],
  ["konya", "Turquía"],
  ["la paz", "Bolivia"],
  ["laos", "Laos"],
  ["leeds", "Reino Unido"],
  ["leon", "México"],
  ["lisboa", "Portugal"],
  ["london", "Reino Unido"],
  ["magnolia arkansas", "Estados Unidos"],
  ["madrid", "España"],
  ["medellin", "Colombia"],
  ["boadilla del monte", "España"],
  ["miami", "Estados Unidos"],
  ["mexico", "México"],
  ["mexico city", "México"],
  ["ciudad de mexico", "México"],
  ["cdmx", "México"],
  ["monterrey", "México"],
  ["mumbai", "India"],
  ["naucalpan de juarez", "México"],
  ["netherlands", "Países Bajos"],
  ["nuevo leon", "México"],
  ["ontario", "Canadá"],
  ["panama", "Panamá"],
  ["pasadena texas", "Estados Unidos"],
  ["passo fundo", "Brasil"],
  ["peru", "Perú"],
  ["lima", "Perú"],
  ["pe", "Perú"],
  ["portugal", "Portugal"],
  ["queretaro", "México"],
  ["qinzhou", "China"],
  ["qro", "México"],
  ["rajahmundry", "India"],
  ["rexdale", "Canadá"],
  ["roma", "Italia"],
  ["rueil malmaison", "Francia"],
  ["saudi arabia", "Arabia Saudita"],
  ["sao paulo", "Brasil"],
  ["stockholm", "Suecia"],
  ["tangerang", "Indonesia"],
  ["thailand", "Tailandia"],
  ["tokyo", "Japón"],
  ["tuxtla gutierrez", "México"],
  ["turkey", "Turquía"],
  ["umraniye", "Turquía"],
  ["united arab emirates", "Emiratos Árabes Unidos"],
  ["united states", "Estados Unidos"],
  ["valinhos", "Brasil"],
  ["vientiane", "Laos"],
  ["viladecans", "España"],
  ["wageningen", "Países Bajos"],
  ["wrocław", "Polonia"],
  ["wroclaw", "Polonia"],
  ["chile", "Chile"],
  ["cl", "Chile"],
];

const COUNTRY_ALIASES = new Map<string, string>(
  COUNTRY_ALIAS_PAIRS.map(([alias, country]) => [norm(alias), country])
);

const COUNTRY_LABELS = new Map<string, string>(
  [...COUNTRY_ALIASES.values()].map((country) => [key("country", country), country])
);

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

function findCountry(parts: string[], normalizedRaw: string): string | null {
  for (const part of parts) {
    const country = COUNTRY_ALIASES.get(norm(part));
    if (country) return country;
  }
  for (const [alias, country] of COUNTRY_ALIASES) {
    if (normalizedRaw === alias || normalizedRaw.includes(alias)) return country;
  }
  return null;
}

export function normalizeJobLocation(raw: string | null): NormalizedJobLocation {
  if (!raw) return { raw, normalized: false, label: "Sin ubicación", filterKeys: ["missing"] };

  const parts = displayParts(raw);
  const normalizedRaw = norm(raw);
  const commune = findCommune(parts, normalizedRaw);
  const region = findRegion(parts, commune);
  const country = findCountry(parts, normalizedRaw);
  const filterKeys: string[] = [];

  if (commune) filterKeys.push(key("commune", commune));
  if (region) filterKeys.push(key("region", region));
  if (country) filterKeys.push(key("country", country));
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

export function buildLocationFilterOptionsFromRaw(
  rawLocations: Array<string | null>
): LocationFilterOption[] {
  const options = new Map<string, LocationFilterOption>();

  const add = (option: LocationFilterOption) => {
    if (!options.has(option.key)) options.set(option.key, option);
  };

  for (const rawLocation of rawLocations) {
    const location = normalizeJobLocation(rawLocation);
    for (const filterKey of location.filterKeys) {
      if (filterKey === "missing") add({ group: "review", key: filterKey, label: "Sin ubicación" });
      else if (filterKey === "unnormalized")
        add({ group: "review", key: filterKey, label: "No normalizada" });
      else if (filterKey === "zone:gran-santiago")
        add({ group: "zone", key: filterKey, label: "Gran Santiago" });
      else if (filterKey === "zone:gran-concepcion")
        add({ group: "zone", key: filterKey, label: "Gran Concepción" });
      else if (filterKey === "zone:gran-valparaiso")
        add({ group: "zone", key: filterKey, label: "Gran Valparaíso" });
      else if (filterKey.startsWith("region:")) {
        add({
          group: "region",
          key: filterKey,
          label: location.label.split(", ").at(-1) ?? location.label,
        });
      } else if (filterKey.startsWith("country:")) {
        add({
          group: "country",
          key: filterKey,
          label: COUNTRY_LABELS.get(filterKey) ?? filterKey.slice("country:".length),
        });
      } else if (filterKey.startsWith("commune:")) {
        add({ group: "commune", key: filterKey, label: location.label });
      }
    }
  }

  const groupOrder: Record<LocationFilterOption["group"], number> = {
    zone: 0,
    region: 1,
    commune: 2,
    country: 3,
    review: 4,
  };
  return [...options.values()].sort(
    (a, b) => groupOrder[a.group] - groupOrder[b.group] || a.label.localeCompare(b.label, "es")
  );
}

export function buildLocationFilterOptions(rows: JobPostingDTO[]): LocationFilterOption[] {
  return buildLocationFilterOptionsFromRaw(rows.map((row) => row.location));
}

export function matchesLocationFilter(row: JobPostingDTO, filterKey: string): boolean {
  if (filterKey === "ALL") return true;
  return normalizeJobLocation(row.location).filterKeys.includes(filterKey);
}
