export type ImmunotherapyModality = { label: string; detail: string };
export type ImmunotherapyComparison = { aspect: string; scit: string; slit: string };
export type ImmunotherapyAllergen = { name: string; detail: string };
export type ImmunotherapyAge = { label: string; detail: string };
export type ImmunotherapyFaq = { question: string; answer: string };

export type ImmunotherapyContent = {
  intro: string;
  modalities: ImmunotherapyModality[];
  comparison: ImmunotherapyComparison[];
  allergens: ImmunotherapyAllergen[];
  ages: ImmunotherapyAge[];
  benefits: string[];
  faq: ImmunotherapyFaq[];
};

export const inmunoterapiaContent: ImmunotherapyContent = {
  intro:
    "La inmunoterapia administra el alérgeno al que eres sensible en dosis crecientes hasta alcanzar una dosis de mantenimiento, entrenando a tu sistema inmune para desarrollar tolerancia. Es la única terapia que puede modificar el curso natural de la enfermedad alérgica, en lugar de solo aliviar los síntomas. La indicación se define en la consulta médica.",
  modalities: [
    {
      label: "SCIT · subcutánea",
      detail:
        "Inmunoterapia mediante inyecciones administradas en la clínica, con fase de inducción y mantenimiento mensual bajo observación médica.",
    },
    {
      label: "SLIT · sublingual",
      detail:
        "Inmunoterapia en gotas o tabletas de administración diaria en casa, sin agujas y con seguimiento clínico periódico.",
    },
  ],
  comparison: [
    {
      aspect: "Efectividad",
      scit: "Alta eficacia con evidencia histórica sólida; reduce síntomas y el riesgo de progresión a asma.",
      slit: "Eficacia comparable en rinitis alérgica con alta adherencia.",
    },
    {
      aspect: "Comodidad",
      scit: "Inyecciones en clínica durante fase inicial y mantenimiento mensual.",
      slit: "Administración diaria en casa sin agujas.",
    },
    {
      aspect: "Seguridad",
      scit: "Requiere observación posterior a cada dosis en clínica.",
      slit: "Reacciones sistémicas extremadamente raras; primera dosis supervisada.",
    },
    {
      aspect: "Duración",
      scit: "3 a 5 años con resultados sostenidos.",
      slit: "3 a 5 años con seguimiento de adherencia.",
    },
  ],
  allergens: [
    {
      name: "Pólenes",
      detail:
        "Gramíneas, árboles y malezas. Suelen provocar rinitis y conjuntivitis estacional, con síntomas más intensos en primavera y verano.",
    },
    {
      name: "Ácaros del polvo",
      detail:
        "Causantes frecuentes de rinitis y asma alérgica persistente durante todo el año, especialmente en dormitorios y ropa de cama.",
    },
    {
      name: "Epitelios de mascotas",
      detail:
        "Caspa y proteínas de gato, perro y otros animales que pueden desencadenar síntomas respiratorios en personas sensibilizadas.",
    },
    {
      name: "Hongos ambientales",
      detail:
        "Esporas de hongos presentes en ambientes húmedos que pueden agravar la rinitis y el asma alérgica.",
    },
    {
      name: "Veneno de abeja y avispa",
      detail:
        "Para pacientes con antecedentes de reacciones alérgicas graves a picaduras, la inmunoterapia con veneno reduce el riesgo de reacciones futuras.",
    },
  ],
  ages: [
    {
      label: "Niños",
      detail:
        "Habitualmente se considera desde los 6 a 7 años, cuando el sistema inmune está más maduro y el niño colabora mejor con el tratamiento. En casos seleccionados y más graves puede evaluarse antes, siempre bajo criterio médico.",
    },
    {
      label: "Adultos",
      detail:
        "La indicación se define caso a caso según diagnóstico, severidad de los síntomas y estado de salud general. No existe un límite de edad rígido: lo que orienta la decisión es la evaluación clínica.",
    },
    {
      label: "Embarazo",
      detail:
        "Por seguridad, la inmunoterapia no se inicia durante el embarazo. Si la paciente ya estaba en fase de mantenimiento y la toleraba bien, el tratamiento puede continuarse según indicación de su médico tratante.",
    },
  ],
  benefits: [
    "Disminuye síntomas de rinitis, asma y conjuntivitis alérgica.",
    "Reduce la necesidad de antihistamínicos y corticosteroides.",
    "Previene nuevas sensibilizaciones y la progresión de la enfermedad.",
    "Mejora la calidad de vida y el rendimiento diario.",
  ],
  faq: [
    {
      question: "¿Cuánto dura el tratamiento?",
      answer:
        "La inmunoterapia es un tratamiento prolongado. Por lo general se mantiene durante 3 a 5 años para lograr y conservar la tolerancia al alérgeno. La duración exacta la define tu médico según tu evolución.",
    },
    {
      question: "¿Es seguro?",
      answer:
        "Es un tratamiento ampliamente utilizado y con buen perfil de seguridad cuando se realiza con supervisión médica. Las primeras dosis y la modalidad subcutánea se administran en la clínica con observación posterior para manejar cualquier reacción.",
    },
    {
      question: "¿Es con inyección o con gotas?",
      answer:
        "Existen dos modalidades: la subcutánea (SCIT), mediante inyecciones administradas en la clínica, y la sublingual (SLIT), con gotas o tabletas que se toman en casa. La elección depende del diagnóstico, la edad y el estilo de vida de cada paciente.",
    },
    {
      question: "¿Cuándo se ven los resultados?",
      answer:
        "La mejoría es progresiva. Muchas personas notan un alivio gradual de los síntomas durante el primer año de tratamiento, con beneficios que se consolidan al completar el esquema completo.",
    },
    {
      question: "¿Qué pasa si falto a una dosis?",
      answer:
        "La adherencia es clave para obtener buenos resultados. Si faltas a una dosis, no debes duplicar la siguiente: contáctanos para reagendar y ajustar el esquema de forma segura según el tiempo transcurrido.",
    },
    {
      question: "¿La inmunoterapia reemplaza a mis medicamentos?",
      answer:
        "Es un tratamiento modificador de la enfermedad que busca reducir la necesidad de medicación a largo plazo. Durante el proceso, tu médico irá ajustando tus medicamentos de control según cómo evolucionen tus síntomas.",
    },
  ],
};
