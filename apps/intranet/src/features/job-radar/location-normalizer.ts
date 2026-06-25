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

// Comuna → región. Las 346 comunas oficiales de Chile (SUBDERE/INE). `COMMUNE_ALIASES`
// se deriva de las keys (norm() ya normaliza tildes/ñ → no hacen falta alias acentuados).
const COMMUNE_REGION: Record<string, string> = {
  // Arica y Parinacota
  Arica: "Arica y Parinacota",
  Camarones: "Arica y Parinacota",
  Putre: "Arica y Parinacota",
  "General Lagos": "Arica y Parinacota",
  // Tarapacá
  Iquique: "Tarapacá",
  "Alto Hospicio": "Tarapacá",
  "Pozo Almonte": "Tarapacá",
  Camiña: "Tarapacá",
  Colchane: "Tarapacá",
  Huara: "Tarapacá",
  Pica: "Tarapacá",
  // Antofagasta
  Antofagasta: "Antofagasta",
  Mejillones: "Antofagasta",
  "Sierra Gorda": "Antofagasta",
  Taltal: "Antofagasta",
  Calama: "Antofagasta",
  Ollagüe: "Antofagasta",
  "San Pedro de Atacama": "Antofagasta",
  Tocopilla: "Antofagasta",
  "María Elena": "Antofagasta",
  // Atacama
  Copiapó: "Atacama",
  Caldera: "Atacama",
  "Tierra Amarilla": "Atacama",
  Chañaral: "Atacama",
  "Diego de Almagro": "Atacama",
  Vallenar: "Atacama",
  "Alto del Carmen": "Atacama",
  Freirina: "Atacama",
  Huasco: "Atacama",
  // Coquimbo
  "La Serena": "Coquimbo",
  Coquimbo: "Coquimbo",
  Andacollo: "Coquimbo",
  "La Higuera": "Coquimbo",
  Paihuano: "Coquimbo",
  Vicuña: "Coquimbo",
  Illapel: "Coquimbo",
  Canela: "Coquimbo",
  "Los Vilos": "Coquimbo",
  Salamanca: "Coquimbo",
  Ovalle: "Coquimbo",
  Combarbalá: "Coquimbo",
  "Monte Patria": "Coquimbo",
  Punitaqui: "Coquimbo",
  "Río Hurtado": "Coquimbo",
  // Valparaíso
  Valparaíso: "Valparaíso",
  Casablanca: "Valparaíso",
  Concón: "Valparaíso",
  "Juan Fernández": "Valparaíso",
  Puchuncaví: "Valparaíso",
  Quintero: "Valparaíso",
  "Viña del Mar": "Valparaíso",
  "Isla de Pascua": "Valparaíso",
  "Los Andes": "Valparaíso",
  "Calle Larga": "Valparaíso",
  Rinconada: "Valparaíso",
  "San Esteban": "Valparaíso",
  "La Ligua": "Valparaíso",
  Cabildo: "Valparaíso",
  Papudo: "Valparaíso",
  Petorca: "Valparaíso",
  Zapallar: "Valparaíso",
  Quillota: "Valparaíso",
  Calera: "Valparaíso",
  Hijuelas: "Valparaíso",
  "La Cruz": "Valparaíso",
  Nogales: "Valparaíso",
  "San Antonio": "Valparaíso",
  Algarrobo: "Valparaíso",
  Cartagena: "Valparaíso",
  "El Quisco": "Valparaíso",
  "El Tabo": "Valparaíso",
  "Santo Domingo": "Valparaíso",
  "San Felipe": "Valparaíso",
  Catemu: "Valparaíso",
  Llaillay: "Valparaíso",
  Panquehue: "Valparaíso",
  Putaendo: "Valparaíso",
  "Santa María": "Valparaíso",
  Quilpué: "Valparaíso",
  Limache: "Valparaíso",
  Olmué: "Valparaíso",
  "Villa Alemana": "Valparaíso",
  // Región Metropolitana
  Cerrillos: "Región Metropolitana",
  "Cerro Navia": "Región Metropolitana",
  Conchalí: "Región Metropolitana",
  "El Bosque": "Región Metropolitana",
  "Estación Central": "Región Metropolitana",
  Huechuraba: "Región Metropolitana",
  Independencia: "Región Metropolitana",
  "La Cisterna": "Región Metropolitana",
  "La Florida": "Región Metropolitana",
  "La Granja": "Región Metropolitana",
  "La Pintana": "Región Metropolitana",
  "La Reina": "Región Metropolitana",
  "Las Condes": "Región Metropolitana",
  "Lo Barnechea": "Región Metropolitana",
  "Lo Espejo": "Región Metropolitana",
  "Lo Prado": "Región Metropolitana",
  Macul: "Región Metropolitana",
  Maipú: "Región Metropolitana",
  Ñuñoa: "Región Metropolitana",
  "Pedro Aguirre Cerda": "Región Metropolitana",
  Peñalolén: "Región Metropolitana",
  Providencia: "Región Metropolitana",
  Pudahuel: "Región Metropolitana",
  Quilicura: "Región Metropolitana",
  "Quinta Normal": "Región Metropolitana",
  Recoleta: "Región Metropolitana",
  Renca: "Región Metropolitana",
  Santiago: "Región Metropolitana",
  "San Joaquín": "Región Metropolitana",
  "San Miguel": "Región Metropolitana",
  "San Ramón": "Región Metropolitana",
  Vitacura: "Región Metropolitana",
  "Puente Alto": "Región Metropolitana",
  Pirque: "Región Metropolitana",
  "San José de Maipo": "Región Metropolitana",
  Colina: "Región Metropolitana",
  Lampa: "Región Metropolitana",
  Tiltil: "Región Metropolitana",
  "San Bernardo": "Región Metropolitana",
  Buin: "Región Metropolitana",
  "Calera de Tango": "Región Metropolitana",
  Paine: "Región Metropolitana",
  Melipilla: "Región Metropolitana",
  Alhué: "Región Metropolitana",
  Curacaví: "Región Metropolitana",
  "María Pinto": "Región Metropolitana",
  "San Pedro": "Región Metropolitana",
  Talagante: "Región Metropolitana",
  "El Monte": "Región Metropolitana",
  "Isla de Maipo": "Región Metropolitana",
  "Padre Hurtado": "Región Metropolitana",
  Peñaflor: "Región Metropolitana",
  // O'Higgins
  Rancagua: "O'Higgins",
  Codegua: "O'Higgins",
  Coinco: "O'Higgins",
  Coltauco: "O'Higgins",
  Doñihue: "O'Higgins",
  Graneros: "O'Higgins",
  "Las Cabras": "O'Higgins",
  Machalí: "O'Higgins",
  Malloa: "O'Higgins",
  Mostazal: "O'Higgins",
  Olivar: "O'Higgins",
  Peumo: "O'Higgins",
  Pichidegua: "O'Higgins",
  "Quinta de Tilcoco": "O'Higgins",
  Rengo: "O'Higgins",
  Requínoa: "O'Higgins",
  "San Vicente": "O'Higgins",
  Pichilemu: "O'Higgins",
  "La Estrella": "O'Higgins",
  Litueche: "O'Higgins",
  Marchihue: "O'Higgins",
  Navidad: "O'Higgins",
  Paredones: "O'Higgins",
  "San Fernando": "O'Higgins",
  Chépica: "O'Higgins",
  Chimbarongo: "O'Higgins",
  Lolol: "O'Higgins",
  Nancagua: "O'Higgins",
  Palmilla: "O'Higgins",
  Peralillo: "O'Higgins",
  Placilla: "O'Higgins",
  Pumanque: "O'Higgins",
  "Santa Cruz": "O'Higgins",
  // Maule
  Talca: "Maule",
  Constitución: "Maule",
  Curepto: "Maule",
  Empedrado: "Maule",
  Maule: "Maule",
  Pelarco: "Maule",
  Pencahue: "Maule",
  "Río Claro": "Maule",
  "San Clemente": "Maule",
  "San Rafael": "Maule",
  Curicó: "Maule",
  Hualañé: "Maule",
  Licantén: "Maule",
  Molina: "Maule",
  Rauco: "Maule",
  Romeral: "Maule",
  "Sagrada Familia": "Maule",
  Teno: "Maule",
  Vichuquén: "Maule",
  Linares: "Maule",
  Colbún: "Maule",
  Longaví: "Maule",
  Parral: "Maule",
  Retiro: "Maule",
  "San Javier": "Maule",
  "Villa Alegre": "Maule",
  "Yerbas Buenas": "Maule",
  Cauquenes: "Maule",
  Chanco: "Maule",
  Pelluhue: "Maule",
  // Ñuble
  Chillán: "Ñuble",
  Bulnes: "Ñuble",
  "Chillán Viejo": "Ñuble",
  "El Carmen": "Ñuble",
  Pemuco: "Ñuble",
  Pinto: "Ñuble",
  Quillón: "Ñuble",
  "San Ignacio": "Ñuble",
  Yungay: "Ñuble",
  Quirihue: "Ñuble",
  Cobquecura: "Ñuble",
  Coelemu: "Ñuble",
  Ninhue: "Ñuble",
  Portezuelo: "Ñuble",
  Ránquil: "Ñuble",
  Treguaco: "Ñuble",
  "San Carlos": "Ñuble",
  Coihueco: "Ñuble",
  Ñiquén: "Ñuble",
  "San Fabián": "Ñuble",
  "San Nicolás": "Ñuble",
  // Biobío
  Concepción: "Biobío",
  Coronel: "Biobío",
  Chiguayante: "Biobío",
  Florida: "Biobío",
  Hualqui: "Biobío",
  Lota: "Biobío",
  Penco: "Biobío",
  "San Pedro de la Paz": "Biobío",
  "Santa Juana": "Biobío",
  Talcahuano: "Biobío",
  Tomé: "Biobío",
  Hualpén: "Biobío",
  Lebu: "Biobío",
  Arauco: "Biobío",
  Cañete: "Biobío",
  Contulmo: "Biobío",
  Curanilahue: "Biobío",
  "Los Álamos": "Biobío",
  Tirúa: "Biobío",
  "Los Ángeles": "Biobío",
  Antuco: "Biobío",
  Cabrero: "Biobío",
  Laja: "Biobío",
  Mulchén: "Biobío",
  Nacimiento: "Biobío",
  Negrete: "Biobío",
  Quilaco: "Biobío",
  Quilleco: "Biobío",
  "San Rosendo": "Biobío",
  "Santa Bárbara": "Biobío",
  Tucapel: "Biobío",
  Yumbel: "Biobío",
  "Alto Biobío": "Biobío",
  // La Araucanía
  Temuco: "La Araucanía",
  Carahue: "La Araucanía",
  Cunco: "La Araucanía",
  Curarrehue: "La Araucanía",
  Freire: "La Araucanía",
  Galvarino: "La Araucanía",
  Gorbea: "La Araucanía",
  Lautaro: "La Araucanía",
  Loncoche: "La Araucanía",
  Melipeuco: "La Araucanía",
  "Nueva Imperial": "La Araucanía",
  "Padre Las Casas": "La Araucanía",
  Perquenco: "La Araucanía",
  Pitrufquén: "La Araucanía",
  Pucón: "La Araucanía",
  Saavedra: "La Araucanía",
  "Teodoro Schmidt": "La Araucanía",
  Toltén: "La Araucanía",
  Vilcún: "La Araucanía",
  Villarrica: "La Araucanía",
  Cholchol: "La Araucanía",
  Angol: "La Araucanía",
  Collipulli: "La Araucanía",
  Curacautín: "La Araucanía",
  Ercilla: "La Araucanía",
  Lonquimay: "La Araucanía",
  "Los Sauces": "La Araucanía",
  Lumaco: "La Araucanía",
  Purén: "La Araucanía",
  Renaico: "La Araucanía",
  Traiguén: "La Araucanía",
  Victoria: "La Araucanía",
  // Los Ríos
  Valdivia: "Los Ríos",
  Corral: "Los Ríos",
  Lanco: "Los Ríos",
  "Los Lagos": "Los Ríos",
  Máfil: "Los Ríos",
  Mariquina: "Los Ríos",
  Paillaco: "Los Ríos",
  Panguipulli: "Los Ríos",
  "La Unión": "Los Ríos",
  Futrono: "Los Ríos",
  "Lago Ranco": "Los Ríos",
  "Río Bueno": "Los Ríos",
  // Los Lagos
  "Puerto Montt": "Los Lagos",
  Calbuco: "Los Lagos",
  Cochamó: "Los Lagos",
  Fresia: "Los Lagos",
  Frutillar: "Los Lagos",
  "Los Muermos": "Los Lagos",
  Llanquihue: "Los Lagos",
  Maullín: "Los Lagos",
  "Puerto Varas": "Los Lagos",
  Castro: "Los Lagos",
  Ancud: "Los Lagos",
  Chonchi: "Los Lagos",
  "Curaco de Vélez": "Los Lagos",
  Dalcahue: "Los Lagos",
  Puqueldón: "Los Lagos",
  Queilén: "Los Lagos",
  Quellón: "Los Lagos",
  Quemchi: "Los Lagos",
  Quinchao: "Los Lagos",
  Osorno: "Los Lagos",
  "Puerto Octay": "Los Lagos",
  Purranque: "Los Lagos",
  Puyehue: "Los Lagos",
  "Río Negro": "Los Lagos",
  "San Juan de la Costa": "Los Lagos",
  "San Pablo": "Los Lagos",
  Chaitén: "Los Lagos",
  Futaleufú: "Los Lagos",
  Hualaihué: "Los Lagos",
  Palena: "Los Lagos",
  // Aysén
  Coyhaique: "Aysén",
  "Lago Verde": "Aysén",
  Aysén: "Aysén",
  Cisnes: "Aysén",
  Guaitecas: "Aysén",
  Cochrane: "Aysén",
  "O'Higgins": "Aysén",
  Tortel: "Aysén",
  "Chile Chico": "Aysén",
  "Río Ibáñez": "Aysén",
  // Magallanes
  "Punta Arenas": "Magallanes",
  "Laguna Blanca": "Magallanes",
  "Río Verde": "Magallanes",
  "San Gregorio": "Magallanes",
  "Cabo de Hornos": "Magallanes",
  Antártica: "Magallanes",
  Porvenir: "Magallanes",
  Primavera: "Magallanes",
  Timaukel: "Magallanes",
  Natales: "Magallanes",
  "Torres del Paine": "Magallanes",
};

const COMMUNE_ALIASES = new Map<string, string>(
  Object.keys(COMMUNE_REGION).map((name) => [norm(name), name])
);
// Variantes de feed cuyo nombre difiere del oficial de la comuna.
COMMUNE_ALIASES.set(norm("Puerto Natales"), "Natales");
COMMUNE_ALIASES.set(norm("Puerto Aysén"), "Aysén");
COMMUNE_ALIASES.set(norm("Puerto Aisén"), "Aysén");
// Faenas/sitios mineros que los feeds (SQM, Gold Fields) ponen como ubicación;
// no son comunas → mapeados a su comuna real. También evita el falso positivo de
// "Nueva Victoria" matcheando "Victoria" (La Araucanía) por substring.
COMMUNE_ALIASES.set(norm("Nueva Victoria"), "Pozo Almonte");
COMMUNE_ALIASES.set(norm("Coya Sur"), "María Elena");
COMMUNE_ALIASES.set(norm("Salares Norte"), "Diego de Almagro");

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
