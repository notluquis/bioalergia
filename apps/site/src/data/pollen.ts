export type PollenLevel = "alto" | "medio" | "bajo";

export interface PollenCalendarEntry {
  season: string;
  months: string;
  level: PollenLevel;
  dominant: string;
}

export interface PollenType {
  name: string;
  examples: string;
  season: string;
  note: string;
}

export interface PolenContent {
  intro: string;
  externalUrl: string;
  calendar: PollenCalendarEntry[];
  types: PollenType[];
  tips: string[];
}

export const polenContent: PolenContent = {
  intro:
    "El polen es el material reproductivo que liberan árboles, pastos y malezas, y que el viento transporta por el aire. La aerobiología estudia esos granos suspendidos en la atmósfera. Cuando una persona alérgica los respira, pueden desencadenar rinitis alérgica (estornudos, congestión, picazón nasal y ocular) y crisis de asma. Conocer qué pólenes predominan en cada estación ayuda a anticipar los síntomas y a planificar el tratamiento.",
  externalUrl: "https://www.polenes.cl",
  calendar: [
    {
      season: "Invierno",
      months: "Junio – Agosto",
      level: "bajo",
      dominant: "Baja actividad polínica; predominan cipreses y arizónicas hacia fin de invierno",
    },
    {
      season: "Primavera",
      months: "Septiembre – Noviembre",
      level: "alto",
      dominant: "Árboles (plátano oriental, abedul, fresno) y comienzo de las gramíneas",
    },
    {
      season: "Verano",
      months: "Diciembre – Febrero",
      level: "medio",
      dominant: "Gramíneas en su peak y primeras malezas",
    },
    {
      season: "Otoño",
      months: "Marzo – Mayo",
      level: "medio",
      dominant: "Malezas (llantén, chenopodium) y esporas de hongos ambientales",
    },
  ],
  types: [
    {
      name: "Árboles",
      examples: "Plátano oriental, abedul, ciprés y arizónica, encina y roble, fresno",
      season: "Fin de invierno y primavera",
      note: "El plátano oriental, muy plantado en calles y avenidas urbanas, es uno de los árboles más asociados a síntomas alérgicos en primavera temprana.",
    },
    {
      name: "Gramíneas (pastos)",
      examples: "Ballica, pasto miel y otros pastos silvestres y de jardín",
      season: "Primavera y verano",
      note: "Las gramíneas son la principal causa de polinosis (alergia al polen) y sus síntomas suelen ser más intensos en días secos, soleados y con viento.",
    },
    {
      name: "Malezas",
      examples: "Llantén, ortiga, chenopodium (quínoa silvestre), ambrosía",
      season: "Verano y otoño",
      note: "Las malezas prolongan la temporada alérgica hacia el final del verano y el otoño, cuando los árboles y gramíneas ya han disminuido.",
    },
  ],
  tips: [
    "Ventila tu casa temprano en la mañana o de noche, cuando los niveles de polen suelen ser más bajos.",
    "Mantén las ventanas cerradas en días ventosos y secos, sobre todo en primavera.",
    "Usa lentes de sol al estar al aire libre para proteger los ojos del polen.",
    "Dúchate y cámbiate de ropa al llegar a casa para retirar el polen del pelo y la piel.",
    "Evita secar la ropa al aire libre durante los días de mayor concentración de polen.",
    "Revisa el pronóstico de polen antes de planificar actividades al exterior.",
  ],
};
