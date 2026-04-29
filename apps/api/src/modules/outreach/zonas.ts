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

export const CATEGORIAS_GOOGLE_PLACES = [
  "factory",
  "storage",
  "moving_company",
  "shopping_mall",
  "department_store",
  "supermarket",
  "lawyer",
  "accounting",
  "insurance_agency",
  "real_estate_agency",
  "general_contractor",
  "university",
  "physiotherapist",
  "dentist",
  "city_hall",
  "local_government_office",
  "fire_station",
  "police",
] as const;

export type CategoriaGooglePlaces = (typeof CATEGORIAS_GOOGLE_PLACES)[number];

export const TYPE_TO_PROSPECT_KIND: Record<
  string,
  "EMPRESA" | "MUNICIPIO" | "INSTITUCION" | "UNIVERSIDAD"
> = {
  factory: "EMPRESA",
  storage: "EMPRESA",
  moving_company: "EMPRESA",
  shopping_mall: "EMPRESA",
  department_store: "EMPRESA",
  supermarket: "EMPRESA",
  lawyer: "EMPRESA",
  accounting: "EMPRESA",
  insurance_agency: "EMPRESA",
  real_estate_agency: "EMPRESA",
  general_contractor: "EMPRESA",
  university: "UNIVERSIDAD",
  physiotherapist: "EMPRESA",
  dentist: "EMPRESA",
  city_hall: "MUNICIPIO",
  local_government_office: "INSTITUCION",
  fire_station: "INSTITUCION",
  police: "INSTITUCION",
};
