export type Exam = {
  id: string;
  name: string;
  category: "Molecular" | "Cutáneo" | "Provocación" | "Vascular";
  summary: string;
  detects: string[];
  duration?: string;
  prep?: string;
  featured?: boolean;
};

export const examenesContent: { intro: string; items: Exam[] } = {
  intro:
    "Combinamos pruebas cutáneas, diagnóstico molecular y estudios de provocación controlada para identificar con precisión qué desencadena tus síntomas y diseñar un tratamiento a tu medida. El estudio indicado se define en la consulta médica.",
  items: [
    {
      id: "alex2",
      name: "Test ALEX2 — diagnóstico molecular",
      category: "Molecular",
      summary:
        "Estudio multiplex de alergia que mide, a partir de una sola muestra de sangre, la IgE específica frente a cientos de alérgenos y componentes moleculares. Permite distinguir sensibilizaciones genuinas de reacciones cruzadas y diseñar inmunoterapia de precisión.",
      detects: [
        "Alergias alimentarias, inhalantes y de contacto en un mismo perfil.",
        "Componentes moleculares para estimar riesgo de reacción grave.",
        "Reactividad cruzada entre pólenes, alimentos y ácaros.",
      ],
      duration: "Extracción de sangre estándar; resultados en días.",
      prep: "No requiere suspender antihistamínicos.",
      featured: true,
    },
    {
      id: "prick",
      name: "Test cutáneo (Prick test)",
      category: "Cutáneo",
      summary:
        "Prueba de referencia para alergias respiratorias y alimentarias. Se aplican gotas de extractos alergénicos sobre la piel del antebrazo y se realiza una micropunción superficial para observar la reacción local.",
      detects: [
        "Sensibilización a ácaros, pólenes, hongos, epitelios de mascotas.",
        "Alergia a alimentos frecuentes.",
        "Confirmación dirigida de alérgenos sospechados en la consulta.",
      ],
      duration: "Lectura a los 15–20 minutos.",
      prep: "Suspender antihistamínicos según indicación médica previa.",
      featured: true,
    },
    {
      id: "parche",
      name: "Test de parche (Patch test)",
      category: "Cutáneo",
      summary:
        "Estudio para dermatitis alérgica de contacto. Se fijan parches con sustancias estandarizadas en la espalda durante 48 horas y se realizan lecturas seriadas para identificar el agente responsable.",
      detects: [
        "Alergia de contacto a metales, fragancias, conservantes y cosméticos.",
        "Causas de eccema persistente o de origen laboral.",
      ],
      duration: "48 h de aplicación + lecturas a 48 y 96 h.",
      prep: "No mojar la zona ni exponerla al sol durante el estudio.",
    },
    {
      id: "suero-autologo",
      name: "Test de suero autólogo",
      category: "Cutáneo",
      summary:
        "Prueba orientada al estudio de la urticaria crónica espontánea. Se inyecta de forma intradérmica suero del propio paciente para evaluar una respuesta autoinmune subyacente.",
      detects: [
        "Componente autoinmune en urticaria crónica.",
        "Apoyo para orientar el tratamiento de habones recurrentes.",
      ],
      duration: "Lectura a los 30 minutos.",
    },
    {
      id: "cubito-hielo",
      name: "Test del cubito de hielo",
      category: "Provocación",
      summary:
        "Prueba sencilla para confirmar la urticaria por frío. Se aplica un cubo de hielo sobre la piel del antebrazo durante unos minutos y se observa la aparición de un habón al recuperar la temperatura.",
      detects: ["Urticaria inducida por frío (urticaria a frigore)."],
      duration: "Pocos minutos de aplicación + lectura inmediata.",
    },
    {
      id: "patergia",
      name: "Test de patergia",
      category: "Cutáneo",
      summary:
        "Estudio de hiperreactividad cutánea utilizado en la evaluación de la enfermedad de Behçet. Se realiza una micropunción estéril y se valora la respuesta inflamatoria a las 24–48 horas.",
      detects: ["Apoyo diagnóstico en sospecha de enfermedad de Behçet."],
      duration: "Lectura a las 24–48 h.",
    },
    {
      id: "intradermica",
      name: "Prueba intradérmica",
      category: "Cutáneo",
      summary:
        "Prueba de mayor sensibilidad que el prick, en la que se inyecta una pequeña cantidad de alérgeno en la dermis. Se utiliza especialmente en el estudio de alergia a medicamentos y a venenos de himenópteros.",
      detects: [
        "Alergia a fármacos (p. ej. betalactámicos).",
        "Alergia a veneno de abeja y avispa.",
      ],
      duration: "Lectura a los 15–20 minutos.",
      prep: "Se realiza bajo supervisión médica con monitorización.",
    },
    {
      id: "capilaroscopia",
      name: "Capilaroscopía",
      category: "Vascular",
      summary:
        "Examen no invasivo que observa, con aumento, los capilares del lecho ungueal. Aporta información en el estudio de fenómeno de Raynaud y de enfermedades autoinmunes del tejido conectivo.",
      detects: [
        "Patrones capilares asociados a esclerodermia y conectivopatías.",
        "Apoyo en el estudio del fenómeno de Raynaud.",
      ],
      duration: "Examen indoloro de pocos minutos.",
      prep: "Evitar manicura o trauma en las uñas días antes.",
    },
    {
      id: "provocacion",
      name: "Prueba de provocación controlada",
      category: "Provocación",
      summary:
        "Estándar de referencia para confirmar o descartar una alergia a alimentos o medicamentos. La administración del alérgeno se realiza de forma gradual y controlada, en un entorno clínico preparado para actuar ante cualquier reacción.",
      detects: [
        "Confirmación o descarte de alergia alimentaria.",
        "Tolerancia a fármacos tras una reacción dudosa.",
      ],
      duration: "Varias horas según protocolo.",
      prep: "Siempre supervisada por el equipo médico.",
    },
  ],
};
