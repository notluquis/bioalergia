export type BotiquinItem = {
  name: string;
  why: string;
  note?: string;
  shopHref?: string;
};

export type BotiquinGroup = {
  category: string;
  intro: string;
  items: BotiquinItem[];
};

export type BotiquinContent = {
  intro: string;
  groups: BotiquinGroup[];
  safetyNote: string;
};

export const botiquinContent: BotiquinContent = {
  intro:
    "Un botiquín para alergias es un conjunto de elementos pensados para controlar el ambiente, aliviar los síntomas y responder ante una emergencia. Esta guía reúne lo esencial de forma educativa: no es una lista de compras universal, sino un punto de partida que debes personalizar junto a tu médico tratante según tu diagnóstico y tu historia clínica.",
  groups: [
    {
      category: "Control ambiental",
      intro:
        "Reducir la carga de alérgenos en casa es la primera línea de defensa: menos exposición significa menos síntomas y, muchas veces, menos necesidad de medicamentos.",
      items: [
        {
          name: "Fundas antiácaros para colchón y almohada",
          why: "Crean una barrera de tejido de poro fino que impide que los ácaros del polvo y sus residuos lleguen a tus vías respiratorias mientras duermes, justo donde pasas un tercio del día.",
          note: "Lava la ropa de cama con agua caliente (sobre 55 °C) cada semana para potenciar el efecto.",
        },
        {
          name: "Purificador de aire con filtro HEPA",
          why: "Captura partículas finas en suspensión como polen, caspa de mascotas y restos de ácaros, ayudando a mantener un aire más limpio en el dormitorio y las áreas donde pasas más tiempo.",
          note: "Busca un filtro HEPA real y dimensiona el equipo al tamaño de la habitación para que sea efectivo.",
          shopHref: "/tienda",
        },
      ],
    },
    {
      category: "Higiene nasal",
      intro:
        "El lavado nasal arrastra alérgenos, mucosidad y contaminantes de la mucosa. Es una medida segura, económica y útil tanto en rinitis alérgica como tras la exposición al polen.",
      items: [
        {
          name: "Irrigación nasal con solución salina",
          why: "El lavado con suero fisiológico o solución salina isotónica limpia las fosas nasales, reduce la congestión y elimina los alérgenos que se depositan durante el día.",
          note: "Usa siempre agua estéril, hervida y enfriada, o suero envasado. Nunca agua de la llave directamente.",
        },
        {
          name: "Spray nasal de solución salina",
          why: "Una versión práctica y portátil para humectar la mucosa y aliviar la sequedad o la congestión leve cuando estás fuera de casa.",
          note: "No contiene fármacos, por lo que puede usarse con frecuencia para mantener la nariz hidratada.",
          shopHref: "/tienda",
        },
      ],
    },
    {
      category: "Alivio sintomático",
      intro:
        "Estos medicamentos controlan los síntomas de la alergia, pero deben formar parte de un plan definido por tu médico tratante: la elección, la dosis y la duración dependen de tu caso.",
      items: [
        {
          name: "Antihistamínicos orales",
          why: "Bloquean la histamina, la sustancia responsable de la picazón, los estornudos, la secreción nasal y los ojos llorosos. Son la base del alivio en la rinitis y la urticaria.",
          note: "Según indicación médica. Prefiere los de segunda generación (no sedantes) cuando el especialista los recomiende.",
        },
        {
          name: "Colirio antialérgico",
          why: "Alivia la picazón, el enrojecimiento y el lagrimeo de la conjuntivitis alérgica actuando directamente sobre los ojos, donde los antihistamínicos orales a veces no alcanzan.",
          note: "Según indicación médica. Suspende su uso y consulta si aparece dolor o cambios en la visión.",
        },
        {
          name: "Corticoide nasal",
          why: "Es el tratamiento más eficaz para la congestión y la inflamación de la rinitis alérgica moderada a severa, con efecto sostenido cuando se usa de forma constante.",
          note: "Solo según prescripción médica. Su beneficio aparece tras varios días de uso continuo, no de inmediato.",
        },
      ],
    },
    {
      category: "Emergencia",
      intro:
        "Para quienes han tenido reacciones alérgicas graves, estar preparado para una emergencia puede salvar la vida. Estos elementos no reemplazan la atención médica urgente.",
      items: [
        {
          name: "Autoinyector de adrenalina (epinefrina)",
          why: "Es el único tratamiento de primera línea para la anafilaxia. Detiene la reacción alérgica grave mientras se llega a un servicio de urgencia.",
          note: "REQUIERE RECETA MÉDICA. Indispensable para quienes han tenido anafilaxia. Tras usarlo, acude SIEMPRE a urgencias de inmediato y revisa la fecha de vencimiento.",
        },
        {
          name: "Plan de acción escrito",
          why: "Un documento claro, elaborado con tu médico, que indica cómo reconocer una reacción grave, qué hacer paso a paso y a quién avisar. Reduce la duda en los momentos críticos.",
          note: "Compártelo con tu familia, tu colegio o tu trabajo para que sepan cómo actuar contigo.",
        },
      ],
    },
    {
      category: "Cuidado de la piel",
      intro:
        "En la dermatitis atópica y otras alergias cutáneas, mantener la barrera de la piel sana previene brotes y reduce la picazón. La hidratación constante es tan importante como la medicación.",
      items: [
        {
          name: "Humectantes y emolientes",
          why: "Restauran la barrera cutánea, retienen la humedad y alivian la sequedad y la picazón propias de la dermatitis atópica. Aplicados a diario, espacian los brotes.",
          note: "Aplica sobre la piel aún húmeda tras el baño para sellar la hidratación.",
        },
        {
          name: "Jabón syndet sin fragancia",
          why: "Limpia respetando el pH de la piel, sin los detergentes agresivos ni los perfumes que resecan e irritan la piel sensible o atópica.",
          note: "Evita los jabones en barra tradicionales y los productos con fragancia añadida.",
        },
      ],
    },
  ],
  safetyNote:
    "Esta guía tiene fines educativos y no reemplaza una consulta médica. Los medicamentos deben usarse según indicación de tu especialista, y el autoinyector de adrenalina requiere receta médica. Ante una reacción alérgica grave (dificultad para respirar, hinchazón de labios o garganta, mareo), usa la adrenalina si la tienes indicada y acude de inmediato a un servicio de urgencia. Revisa con regularidad las fechas de vencimiento de todo tu botiquín.",
};
