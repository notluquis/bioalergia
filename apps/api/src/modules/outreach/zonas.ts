export type Zona = {
  ciudad: string;
  nombre: string;
  lat: number;
  lng: number;
  radio: number;
};

export const ZONAS: Zona[] = [
  { ciudad: "Concepción", nombre: "Centro Concepción", lat: -36.827, lng: -73.0498, radio: 3000 },
  { ciudad: "Talcahuano", nombre: "Talcahuano", lat: -36.7241, lng: -73.1171, radio: 4000 },
  {
    ciudad: "San Pedro de la Paz",
    nombre: "San Pedro de la Paz",
    lat: -36.8722,
    lng: -73.1062,
    radio: 3000,
  },
  { ciudad: "Chiguayante", nombre: "Chiguayante", lat: -36.9253, lng: -73.0289, radio: 2000 },
  { ciudad: "Coronel", nombre: "Coronel", lat: -37.0269, lng: -73.1521, radio: 3000 },
  { ciudad: "Hualpén", nombre: "Hualpén", lat: -36.7892, lng: -73.0981, radio: 2500 },
];

// Places API (New) Table A primary types.
// Ref: https://developers.google.com/maps/documentation/places/web-service/place-types
// Tipos Legacy "factory" y "general_contractor" NO existen en la New — para casos así
// usar textQuery (ej: "fábrica concepción") en lugar de includedTypes.
export const CATEGORIAS_GOOGLE_PLACES = [
  // Comercio
  "shopping_mall",
  "department_store",
  "supermarket",
  // Servicios profesionales
  "lawyer",
  "accounting",
  "insurance_agency",
  "real_estate_agency",
  "travel_agency",
  // Logística / industria
  "storage",
  "moving_company",
  // Salud (potenciales convenios)
  "hospital",
  "pharmacy",
  "physiotherapist",
  "dentist",
  // Empresas/empleados
  "bank",
  "gym",
  "spa",
  // Educación
  "university",
  "school",
  "primary_school",
  "secondary_school",
  // Instituciones públicas
  "city_hall",
  "local_government_office",
  "courthouse",
  "embassy",
  "fire_station",
  "police",
  "post_office",
  "library",
] as const;

export type CategoriaGooglePlaces = (typeof CATEGORIAS_GOOGLE_PLACES)[number];

export const TYPE_TO_PROSPECT_KIND: Record<
  string,
  "EMPRESA" | "MUNICIPIO" | "INSTITUCION" | "UNIVERSIDAD" | "COLEGIO"
> = {
  shopping_mall: "EMPRESA",
  department_store: "EMPRESA",
  supermarket: "EMPRESA",
  lawyer: "EMPRESA",
  accounting: "EMPRESA",
  insurance_agency: "EMPRESA",
  real_estate_agency: "EMPRESA",
  travel_agency: "EMPRESA",
  storage: "EMPRESA",
  moving_company: "EMPRESA",
  hospital: "EMPRESA",
  pharmacy: "EMPRESA",
  physiotherapist: "EMPRESA",
  dentist: "EMPRESA",
  bank: "EMPRESA",
  gym: "EMPRESA",
  spa: "EMPRESA",
  university: "UNIVERSIDAD",
  school: "COLEGIO",
  primary_school: "COLEGIO",
  secondary_school: "COLEGIO",
  city_hall: "MUNICIPIO",
  local_government_office: "INSTITUCION",
  courthouse: "INSTITUCION",
  embassy: "INSTITUCION",
  fire_station: "INSTITUCION",
  police: "INSTITUCION",
  post_office: "INSTITUCION",
  library: "INSTITUCION",
};
