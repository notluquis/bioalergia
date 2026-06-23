import type { JobPostingDTO } from "@finanzas/orpc-contracts/job-radar";

export interface NormalizedJobLocation {
  raw: string | null;
  normalized: boolean;
  label: string;
  filterKeys: string[];
}

export interface LocationFilterOption {
  group: "commune" | "country" | "mode" | "region" | "remote" | "review" | "zone";
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
  ["region del biobio", "Biobío"],
  ["region del bio bio", "Biobío"],
  ["viii del biobio", "Biobío"],
  ["viii del bio bio", "Biobío"],
  ["viii region del biobio", "Biobío"],
  ["viii region del bio bio", "Biobío"],
  ["araucania", "La Araucanía"],
  ["la araucania", "La Araucanía"],
  ["region de la araucania", "La Araucanía"],
  ["ohiggins", "O'Higgins"],
  ["o higgins", "O'Higgins"],
  ["region de ohiggins", "O'Higgins"],
  ["lib gral bdo o higgins", "O'Higgins"],
  ["libertador b o higgins", "O'Higgins"],
  ["libertador bernardo o higgins", "O'Higgins"],
  ["region del maule", "Maule"],
  ["nuble", "Ñuble"],
  ["region de nuble", "Ñuble"],
  ["los rios", "Los Ríos"],
  ["region de los rios", "Los Ríos"],
  ["xiv de los rios", "Los Ríos"],
  ["xiv region de los rios", "Los Ríos"],
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
    "Constitución",
    "Talcahuano",
    "Chiguayante",
    "Hualpén",
    "Penco",
    "San Pedro de la Paz",
    "Coronel",
    "Lota",
    "Tomé",
    "Hualqui",
    "Arauco",
    "Laja",
    "Los Ángeles",
    "Valparaíso",
    "Viña del Mar",
    "Concón",
    "Quillota",
    "Quilpué",
    "Villa Alemana",
    "Antofagasta",
    "Calama",
    "San Pedro de Atacama",
    "La Serena",
    "Coquimbo",
    "Rancagua",
    "Talca",
    "Chillán",
    "Diguillín",
    "Temuco",
    "Collipulli",
    "Nueva Imperial",
    "Puerto Montt",
    "Puerto Varas",
    "Valdivia",
    "Osorno",
    "La Unión",
    "Copiapó",
    "Iquique",
    "Arica",
    "Colina",
    "Castro",
    "Chonchi",
    "Coyhaique",
    "Curicó",
    "Curarrehue",
    "Curepto",
    "Calbuco",
    "Chañaral",
    "Frutillar",
    "Illapel",
    "Lampa",
    "Los Andes",
    "Melipeuco",
    "Machalí",
    "Mulchén",
    "Mariquina",
    "Negrete",
    "Puerto Natales",
    "Punta Arenas",
    "Romeral",
    "Salamanca",
    "Sagrada Familia",
    "San Antonio",
    "San Francisco de Mostazal",
    "San Vicente",
    "Santa Cruz",
    "Santa Bárbara",
    "Teno",
    "Yerbas Buenas",
  ].map((name) => [norm(name), name])
);

COMMUNE_ALIASES.set(norm("Concepcion"), "Concepción");
COMMUNE_ALIASES.set(norm("Vina del Mar"), "Viña del Mar");
COMMUNE_ALIASES.set(norm("Maipu"), "Maipú");
COMMUNE_ALIASES.set(norm("Nunoa"), "Ñuñoa");

const COMMUNE_REGION: Record<string, string> = {
  Antofagasta: "Antofagasta",
  Arauco: "Biobío",
  Arica: "Arica y Parinacota",
  Calbuco: "Los Lagos",
  Calama: "Antofagasta",
  Castro: "Los Lagos",
  Chañaral: "Atacama",
  Chillán: "Ñuble",
  Chonchi: "Los Lagos",
  Colina: "Región Metropolitana",
  Collipulli: "La Araucanía",
  Concepción: "Biobío",
  Constitución: "Maule",
  Coquimbo: "Coquimbo",
  Coyhaique: "Aysén",
  Copiapó: "Atacama",
  Curicó: "Maule",
  Curarrehue: "La Araucanía",
  Curepto: "Maule",
  Diguillín: "Ñuble",
  Frutillar: "Los Lagos",
  Illapel: "Coquimbo",
  Iquique: "Tarapacá",
  "La Serena": "Coquimbo",
  "La Unión": "Los Ríos",
  Lampa: "Región Metropolitana",
  Laja: "Biobío",
  "Los Ángeles": "Biobío",
  "Los Andes": "Valparaíso",
  Machalí: "O'Higgins",
  Melipeuco: "La Araucanía",
  Mariquina: "Los Ríos",
  Mulchén: "Biobío",
  Negrete: "Biobío",
  Osorno: "Los Lagos",
  "Puerto Montt": "Los Lagos",
  "Puerto Natales": "Magallanes",
  "Puerto Varas": "Los Lagos",
  "Punta Arenas": "Magallanes",
  Quillota: "Valparaíso",
  Rancagua: "O'Higgins",
  Romeral: "Maule",
  Salamanca: "Coquimbo",
  "Sagrada Familia": "Maule",
  "San Pedro de Atacama": "Antofagasta",
  "San Antonio": "Valparaíso",
  "San Francisco de Mostazal": "O'Higgins",
  "San Vicente": "O'Higgins",
  "Santa Cruz": "O'Higgins",
  "Santa Bárbara": "Biobío",
  Talca: "Maule",
  Teno: "Maule",
  Temuco: "La Araucanía",
  "Nueva Imperial": "La Araucanía",
  Valdivia: "Los Ríos",
  Valparaíso: "Valparaíso",
  "Viña del Mar": "Valparaíso",
  "Yerbas Buenas": "Maule",
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
  ["hungary", "Hungría"],
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
  ["montes claros", "Brasil"],
  ["missouri", "Estados Unidos"],
  ["mo", "Estados Unidos"],
  ["mumbai", "India"],
  ["naucalpan de juarez", "México"],
  ["netherlands", "Países Bajos"],
  ["new jersey", "Estados Unidos"],
  ["nj", "Estados Unidos"],
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
  ["tai pei", "Taiwán"],
  ["taiwan", "Taiwán"],
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
  ["america santiago", "Chile"],
  ["america lima", "Perú"],
  ["america buenos aires", "Argentina"],
  ["america argentina buenos aires", "Argentina"],
  ["america bogota", "Colombia"],
  ["america sao paulo", "Brasil"],
  ["america mexico city", "México"],
  ["us", "Estados Unidos"],
  ["usa", "Estados Unidos"],
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

function normalizeRemoteMode(remote: string | null | undefined): string | null {
  if (!remote) return null;
  const n = norm(remote);
  if (n.includes("remot") || n === "telecommute") return "Remoto";
  if (n.includes("hibrid") || n.includes("hybrid")) return "Híbrido";
  if (n.includes("presencial") || n.includes("onsite") || n.includes("on site"))
    return "Presencial";
  return remote.trim().length > 0 ? remote.trim() : null;
}

function remoteScopeKey(mode: string | null, country: string | null): string | null {
  if (mode !== "Remoto") return null;
  if (country === "Chile") return "remote:chile";
  if (country) return "remote:international";
  return "remote:unknown";
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
  if (normalizedRaw.startsWith("america ")) return null;
  for (const part of parts) {
    const direct = COMMUNE_ALIASES.get(norm(part));
    if (direct) return direct;
  }
  const paddedRaw = ` ${normalizedRaw} `;
  for (const [alias, commune] of COMMUNE_ALIASES) {
    if (paddedRaw.includes(` ${alias} `)) return commune;
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
    if (normalizedRaw === alias) return country;
    if (alias.length <= 2) continue;
    if (normalizedRaw === alias || normalizedRaw.includes(alias)) return country;
  }
  return null;
}

export function normalizeJobLocation(
  raw: string | null,
  remote?: string | null
): NormalizedJobLocation {
  const mode = normalizeRemoteMode(remote);
  if (!raw && !mode)
    return { raw, normalized: false, label: "Sin ubicación", filterKeys: ["missing"] };

  const parts = raw ? displayParts(raw) : [];
  const normalizedRaw = raw ? norm(raw) : "";
  const commune = findCommune(parts, normalizedRaw);
  const region = findRegion(parts, commune);
  const country = findCountry(parts, normalizedRaw) ?? (commune || region ? "Chile" : null);
  const filterKeys: string[] = [];

  if (commune) filterKeys.push(key("commune", commune));
  if (region) filterKeys.push(key("region", region));
  // Chile keeps its own option; non-Chile países se agrupan en un solo bucket
  // "Otros países", excepto los remotos (esos viven en remote:international).
  if (country === "Chile") filterKeys.push(key("country", country));
  else if (country && mode !== "Remoto") filterKeys.push("country:international");
  if (mode) filterKeys.push(key("mode", mode));
  const remoteScope = remoteScopeKey(mode, country);
  if (remoteScope) filterKeys.push(remoteScope);
  if (commune && GRAN_SANTIAGO.has(commune)) filterKeys.push("zone:gran-santiago");
  if (commune && GRAN_CONCEPCION.has(commune)) filterKeys.push("zone:gran-concepcion");
  if (commune && GRAN_VALPARAISO.has(commune)) filterKeys.push("zone:gran-valparaiso");

  if (filterKeys.length === 0)
    return { raw, normalized: false, label: raw ?? "Sin ubicación", filterKeys: ["unnormalized"] };
  const label =
    commune && region
      ? `${commune}, ${region}`
      : (commune ?? region ?? country ?? mode ?? raw ?? "Sin ubicación");
  return {
    raw,
    normalized: true,
    label,
    filterKeys,
  };
}

function addLocationOptions(
  options: Map<string, LocationFilterOption>,
  location: NormalizedJobLocation
): void {
  const add = (option: LocationFilterOption) => {
    if (!options.has(option.key)) options.set(option.key, option);
  };

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
    else if (filterKey === "remote:chile")
      add({ group: "remote", key: filterKey, label: "Remoto Chile" });
    else if (filterKey === "remote:international")
      add({ group: "remote", key: filterKey, label: "Remoto internacional" });
    else if (filterKey === "remote:unknown")
      add({ group: "remote", key: filterKey, label: "Remoto sin país" });
    else if (filterKey.startsWith("region:")) {
      add({
        group: "region",
        key: filterKey,
        label: location.label.split(", ").at(-1) ?? location.label,
      });
    } else if (filterKey === "country:international") {
      add({ group: "country", key: filterKey, label: "Otros países" });
    } else if (filterKey.startsWith("country:")) {
      add({
        group: "country",
        key: filterKey,
        label: COUNTRY_LABELS.get(filterKey) ?? filterKey.slice("country:".length),
      });
    } else if (filterKey.startsWith("mode:")) {
      add({
        group: "mode",
        key: filterKey,
        label: filterKey === "mode:hibrido" ? "Híbrido" : filterKey.slice("mode:".length),
      });
    } else if (filterKey.startsWith("commune:")) {
      add({ group: "commune", key: filterKey, label: location.label });
    }
  }
}

export function buildLocationFilterOptionsFromRaw(
  rawLocations: Array<string | null>,
  remoteModes: string[] = []
): LocationFilterOption[] {
  const options = new Map<string, LocationFilterOption>();

  const add = (option: LocationFilterOption) => {
    if (!options.has(option.key)) options.set(option.key, option);
  };

  for (const rawLocation of rawLocations) {
    const location = normalizeJobLocation(rawLocation);
    addLocationOptions(options, location);
  }

  for (const remoteMode of remoteModes) {
    const mode = normalizeRemoteMode(remoteMode);
    if (mode) add({ group: "mode", key: key("mode", mode), label: mode });
  }

  const groupOrder: Record<LocationFilterOption["group"], number> = {
    zone: 0,
    region: 1,
    commune: 2,
    country: 3,
    remote: 4,
    mode: 5,
    review: 6,
  };
  return [...options.values()].sort(
    (a, b) => groupOrder[a.group] - groupOrder[b.group] || a.label.localeCompare(b.label, "es")
  );
}

export function buildLocationFilterOptions(rows: JobPostingDTO[]): LocationFilterOption[] {
  const options = new Map<string, LocationFilterOption>();
  for (const row of rows)
    addLocationOptions(options, normalizeJobLocation(row.location, row.remote));
  const groupOrder: Record<LocationFilterOption["group"], number> = {
    zone: 0,
    region: 1,
    commune: 2,
    country: 3,
    remote: 4,
    mode: 5,
    review: 6,
  };
  return [...options.values()].sort(
    (a, b) => groupOrder[a.group] - groupOrder[b.group] || a.label.localeCompare(b.label, "es")
  );
}

export function matchesLocationFilter(row: JobPostingDTO, filterKey: string): boolean {
  if (filterKey === "ALL") return true;
  return normalizeJobLocation(row.location, row.remote).filterKeys.includes(filterKey);
}
