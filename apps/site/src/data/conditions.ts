// Contenido de las páginas de condiciones (/condiciones/$slug) — educación al
// paciente, orientado a SEO. Chile (hemisferio sur): primavera = sep–dic.
// Es contenido referencial, NO diagnóstico. Cada página lleva disclaimer.
// PENDIENTE: validación clínica final por el alergólogo antes de publicar.

import type { QuizContent } from "@/data/quiz";

export interface ConditionSection {
  heading: string;
  body: string;
  bullets?: string[];
}

export interface ConditionFaq {
  question: string;
  answer: string;
}

export interface Condition {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  synonyms: string[];
  heroIntro: string;
  sections: ConditionSection[];
  faq: ConditionFaq[];
  relatedExams: string[];
  quiz: QuizContent;
  lastReviewed: string;
  reviewedBy: string;
}

const QUIZ_DISCLAIMER =
  "Estas preguntas y sus resultados son meramente referenciales y en ningún caso constituyen un diagnóstico médico. Solo un profesional de la salud puede evaluar tu caso.";

const REVIEWED_BY = "Dr. José Manuel Martínez Martínez";
const LAST_REVIEWED = "2026-06-21";

export const conditions: Condition[] = [
  {
    slug: "rinitis-alergica",
    title: "Rinitis alérgica",
    metaTitle: "Rinitis alérgica en Concepción · Bioalergia",
    metaDescription:
      "Estornudos, congestión y picazón nasal persistentes en Concepción. Causas, diagnóstico con prick test e inmunoterapia para la rinitis alérgica.",
    synonyms: ["fiebre del heno", "rinitis estacional", "rinitis perenne"],
    heroIntro:
      "La rinitis alérgica es la inflamación de la mucosa nasal provocada por alérgenos como pólenes, ácaros del polvo, hongos o epitelios de mascotas. Es una de las alergias más frecuentes y, bien estudiada, tiene buen control.",
    sections: [
      {
        heading: "¿Qué es?",
        body: "Una respuesta exagerada del sistema inmune frente a partículas inofensivas que se inhalan. Puede ser estacional (pólenes) o perenne (ácaros, mascotas), y a menudo se asocia a asma y conjuntivitis.",
      },
      {
        heading: "Síntomas",
        body: "Los síntomas suelen aparecer en crisis tras la exposición al alérgeno:",
        bullets: [
          "Estornudos en salva y picazón nasal.",
          "Congestión y secreción nasal acuosa.",
          "Picazón de ojos, paladar u oídos.",
          "Pérdida de olfato y goteo retronasal.",
        ],
      },
      {
        heading: "Causas y desencadenantes",
        body: "En Chile los desencadenantes más comunes son los ácaros del polvo doméstico (todo el año) y los pólenes de gramíneas y árboles como el plátano oriental (primavera, sep–dic).",
      },
      {
        heading: "Diagnóstico",
        body: "El test cutáneo (prick test) es el examen de referencia y entrega resultados en 15–20 minutos. Cuando se requiere más precisión se complementa con IgE específica en sangre o diagnóstico molecular (ALEX2).",
      },
      {
        heading: "Tratamiento",
        body: "Combina control ambiental, antihistamínicos y corticoides nasales. En casos persistentes o con sensibilizaciones definidas, la inmunoterapia (vacunas de alergia SCIT/SLIT) puede modificar el curso de la enfermedad.",
      },
      {
        heading: "¿Cuándo consultar?",
        body: "Si los síntomas se prolongan más de dos semanas, se repiten cada año o afectan tu sueño, concentración o calidad de vida, conviene una evaluación con un especialista.",
      },
    ],
    faq: [
      {
        question: "¿Cómo diferencio una rinitis alérgica de un resfrío?",
        answer:
          "El resfrío dura pocos días y suele dar fiebre y malestar general. La rinitis alérgica se prolonga semanas, cursa con picazón y estornudos, y empeora ante desencadenantes específicos.",
      },
      {
        question: "¿La inmunoterapia cura la rinitis alérgica?",
        answer:
          "No es una cura garantizada, pero en pacientes bien seleccionados reduce los síntomas, disminuye el uso de medicamentos y puede prevenir la progresión a asma. El tratamiento dura 3 a 5 años.",
      },
      {
        question: "¿Necesito suspender los antihistamínicos antes del prick test?",
        answer:
          "Sí, los antihistamínicos pueden alterar el resultado. Tu médico te indicará cuántos días suspenderlos antes del examen.",
      },
      {
        question: "¿La rinitis alérgica se relaciona con el asma?",
        answer:
          "Sí. Comparten mecanismo y muchos pacientes tienen ambas. Controlar la rinitis ayuda al control del asma.",
      },
    ],
    relatedExams: ["Test cutáneo (Prick test)", "Test ALEX2 — diagnóstico molecular"],
    quiz: {
      disclaimer: QUIZ_DISCLAIMER,
      questions: [
        {
          id: "duracion",
          text: "¿Tus estornudos o congestión nasal se prolongan dos semanas o más sin estar resfriado?",
          options: [
            { label: "Sí, con frecuencia", score: 2 },
            { label: "A veces", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "picazon",
          text: "¿Sientes picazón en nariz, ojos o paladar junto con los síntomas?",
          options: [
            { label: "Sí", score: 2 },
            { label: "A veces", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "desencadenante",
          text: "¿Empeoran con polvo, pólenes (primavera) o el contacto con mascotas?",
          options: [
            { label: "Sí, claramente", score: 2 },
            { label: "No estoy seguro/a", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "impacto",
          text: "¿Afectan tu sueño, concentración o ánimo?",
          options: [
            { label: "Sí", score: 2 },
            { label: "A veces", score: 1 },
            { label: "No", score: 0 },
          ],
        },
      ],
      results: [
        {
          level: "bajo",
          upTo: 2,
          title: "Pocas señales de rinitis alérgica",
          message:
            "Tus respuestas muestran pocos síntomas compatibles. Si igual te incomodan o reaparecen, una consulta puede dejarte tranquilo/a.",
        },
        {
          level: "posible",
          upTo: 5,
          title: "Hay señales que vale la pena revisar",
          message:
            "Algunas respuestas son compatibles con rinitis alérgica. Un prick test puede aclarar qué la causa y orientar el tratamiento.",
        },
        {
          level: "alto",
          upTo: null,
          title: "Varias señales compatibles con rinitis alérgica",
          message:
            "Tus respuestas reúnen varias señales frecuentes. Te recomendamos agendar una evaluación para identificar desencadenantes y definir tratamiento.",
        },
      ],
    },
    lastReviewed: LAST_REVIEWED,
    reviewedBy: REVIEWED_BY,
  },
  {
    slug: "asma-alergica",
    title: "Asma alérgica",
    metaTitle: "Asma alérgica en Concepción · Bioalergia",
    metaDescription:
      "Tos, sibilancias y falta de aire por alergia en Concepción. Diagnóstico de asma alérgica, control ambiental e inmunoterapia.",
    synonyms: ["asma bronquial alérgica", "asma atópica"],
    heroIntro:
      "El asma alérgica es una inflamación crónica de los bronquios desencadenada por alérgenos inhalados. Con diagnóstico y tratamiento adecuados, la mayoría de los pacientes logra una vida normal y activa.",
    sections: [
      {
        heading: "¿Qué es?",
        body: "Una enfermedad en que los bronquios se inflaman y estrechan frente a alérgenos (ácaros, pólenes, hongos, mascotas), dificultando el paso del aire. Frecuentemente se asocia a rinitis alérgica.",
      },
      {
        heading: "Síntomas",
        body: "Suelen ser intermitentes y empeorar de noche, con ejercicio o ante el alérgeno:",
        bullets: [
          "Tos persistente, sobre todo nocturna.",
          "Silbido al respirar (sibilancias).",
          "Sensación de falta de aire u opresión en el pecho.",
        ],
      },
      {
        heading: "Causas y desencadenantes",
        body: "Además de los alérgenos, las infecciones respiratorias, el humo de tabaco, el aire frío y la contaminación pueden gatillar crisis. En Concepción la calidad del aire en invierno es un factor a considerar.",
      },
      {
        heading: "Diagnóstico",
        body: "Se confirma con la evaluación clínica más pruebas de función pulmonar (espirometría). El estudio alérgico (prick test o IgE específica) identifica los desencadenantes para orientar el control ambiental y la inmunoterapia.",
      },
      {
        heading: "Tratamiento",
        body: "Incluye inhaladores de control y de rescate, control ambiental y, en asma alérgica bien definida, inmunoterapia. En asma grave existen tratamientos biológicos. El objetivo es el control total de los síntomas.",
      },
      {
        heading: "¿Cuándo consultar?",
        body: "Consulta si usas el inhalador de rescate más de dos veces por semana, despiertas de noche con tos o falta de aire, o has tenido crisis que requirieron urgencia.",
      },
    ],
    faq: [
      {
        question: "¿El asma alérgica se cura?",
        answer:
          "No se cura, pero se controla muy bien. Con tratamiento adecuado la mayoría lleva una vida sin limitaciones. La inmunoterapia puede reducir síntomas y necesidad de medicación en casos seleccionados.",
      },
      {
        question: "¿Puedo hacer deporte si tengo asma?",
        answer:
          "Sí. Con el asma bien controlada el ejercicio es recomendable. Tu médico ajustará el tratamiento para que la actividad física no gatille síntomas.",
      },
      {
        question: "¿La inmunoterapia sirve para el asma?",
        answer:
          "En asma alérgica leve a moderada con sensibilización demostrada, la inmunoterapia puede mejorar el control. No reemplaza a los inhaladores: se indica como complemento y siempre bajo evaluación.",
      },
      {
        question: "¿Qué relación hay entre rinitis y asma?",
        answer:
          "Son parte de la misma enfermedad de la vía aérea. Tratar la rinitis mejora el control del asma; por eso se estudian en conjunto.",
      },
    ],
    relatedExams: ["Test cutáneo (Prick test)", "Test ALEX2 — diagnóstico molecular"],
    quiz: {
      disclaimer: QUIZ_DISCLAIMER,
      questions: [
        {
          id: "tos",
          text: "¿Tienes tos o silbidos al respirar que aparecen de noche o con el ejercicio?",
          options: [
            { label: "Sí, con frecuencia", score: 2 },
            { label: "A veces", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "rescate",
          text: "¿Usas inhalador de rescate más de dos veces por semana?",
          options: [
            { label: "Sí", score: 2 },
            { label: "Ocasionalmente", score: 1 },
            { label: "No / no uso", score: 0 },
          ],
        },
        {
          id: "gatillo",
          text: "¿Tus síntomas empeoran con polvo, mascotas, pólenes o resfríos?",
          options: [
            { label: "Sí", score: 2 },
            { label: "A veces", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "rinitis",
          text: "¿Tienes además congestión o picazón nasal frecuente?",
          options: [
            { label: "Sí", score: 2 },
            { label: "A veces", score: 1 },
            { label: "No", score: 0 },
          ],
        },
      ],
      results: [
        {
          level: "bajo",
          upTo: 2,
          title: "Pocas señales de asma alérgica",
          message:
            "Tus respuestas muestran pocos síntomas compatibles. Ante cualquier dificultad para respirar, consulta igualmente.",
        },
        {
          level: "posible",
          upTo: 5,
          title: "Hay señales respiratorias que conviene evaluar",
          message:
            "Algunas respuestas sugieren síntomas compatibles con asma. Una evaluación con espirometría y estudio alérgico puede aclararlo.",
        },
        {
          level: "alto",
          upTo: null,
          title: "Varias señales compatibles con asma alérgica",
          message:
            "Tus respuestas reúnen señales frecuentes en asma. Te recomendamos una evaluación para confirmar el diagnóstico y lograr un buen control.",
        },
      ],
    },
    lastReviewed: LAST_REVIEWED,
    reviewedBy: REVIEWED_BY,
  },
  {
    slug: "conjuntivitis-alergica",
    title: "Conjuntivitis alérgica",
    metaTitle: "Conjuntivitis alérgica en Concepción · Bioalergia",
    metaDescription:
      "Ojos rojos, con picazón y lagrimeo por alergia en Concepción. Causas, diagnóstico y tratamiento de la conjuntivitis alérgica.",
    synonyms: ["alergia ocular", "conjuntivitis estacional"],
    heroIntro:
      "La conjuntivitis alérgica es la inflamación de la conjuntiva (la membrana que cubre el ojo) por contacto con alérgenos. Suele acompañar a la rinitis alérgica y, aunque molesta, rara vez es grave.",
    sections: [
      {
        heading: "¿Qué es?",
        body: "Una reacción alérgica en los ojos, generalmente por pólenes, ácaros o epitelios de mascotas. Afecta ambos ojos y empeora al frotarlos.",
      },
      {
        heading: "Síntomas",
        body: "Característicamente bilaterales:",
        bullets: [
          "Picazón ocular intensa (síntoma principal).",
          "Ojos rojos y lagrimeo.",
          "Sensación de arena o cuerpo extraño.",
          "Párpados hinchados.",
        ],
      },
      {
        heading: "Causas y desencadenantes",
        body: "Pólenes en primavera, ácaros del polvo durante todo el año y contacto con mascotas. Frotarse los ojos intensifica los síntomas.",
      },
      {
        heading: "Diagnóstico",
        body: "Es principalmente clínico. El estudio alérgico (prick test o IgE específica) ayuda a identificar el alérgeno responsable cuando los síntomas son recurrentes.",
      },
      {
        heading: "Tratamiento",
        body: "Medidas de higiene ocular, compresas frías, antihistamínicos en colirio o vía oral y, en casos persistentes, tratamiento de la alergia de base con inmunoterapia.",
      },
      {
        heading: "¿Cuándo consultar?",
        body: "Si la picazón es intensa, recurrente, hay dolor ocular, visión borrosa o secreción purulenta (que orienta a otra causa), consulta para descartar complicaciones.",
      },
    ],
    faq: [
      {
        question: "¿La conjuntivitis alérgica es contagiosa?",
        answer:
          "No. A diferencia de la conjuntivitis viral o bacteriana, la alérgica no se contagia: es una respuesta del sistema inmune, no una infección.",
      },
      {
        question: "¿Puedo usar cualquier colirio?",
        answer:
          "No conviene automedicarse. Algunos colirios descongestionantes, usados por tiempo prolongado, empeoran el cuadro. Un especialista indicará el tratamiento adecuado.",
      },
      {
        question: "¿Por qué me pican tanto los ojos en primavera?",
        answer:
          "En primavera aumentan los pólenes de gramíneas y árboles, que son potentes desencadenantes de la alergia ocular.",
      },
      {
        question: "¿Frotarme los ojos es malo?",
        answer:
          "Sí. Frotar libera más mediadores de la alergia y aumenta la picazón e inflamación. Las compresas frías son una mejor opción.",
      },
    ],
    relatedExams: ["Test cutáneo (Prick test)"],
    quiz: {
      disclaimer: QUIZ_DISCLAIMER,
      questions: [
        {
          id: "picazon",
          text: "¿Sientes picazón intensa en ambos ojos de forma recurrente?",
          options: [
            { label: "Sí", score: 2 },
            { label: "A veces", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "rojo",
          text: "¿Se te ponen los ojos rojos y con lagrimeo?",
          options: [
            { label: "Sí", score: 2 },
            { label: "A veces", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "estacion",
          text: "¿Empeoran en primavera o con polvo y mascotas?",
          options: [
            { label: "Sí", score: 2 },
            { label: "No estoy seguro/a", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "nasal",
          text: "¿Se acompañan de estornudos o congestión nasal?",
          options: [
            { label: "Sí", score: 2 },
            { label: "A veces", score: 1 },
            { label: "No", score: 0 },
          ],
        },
      ],
      results: [
        {
          level: "bajo",
          upTo: 2,
          title: "Pocas señales de alergia ocular",
          message:
            "Tus respuestas muestran pocos síntomas compatibles. Si los ojos te molestan de forma persistente, consulta igualmente.",
        },
        {
          level: "posible",
          upTo: 5,
          title: "Hay señales de alergia ocular",
          message:
            "Algunas respuestas son compatibles con conjuntivitis alérgica. Una evaluación puede confirmar la causa y aliviar la picazón.",
        },
        {
          level: "alto",
          upTo: null,
          title: "Varias señales compatibles con conjuntivitis alérgica",
          message:
            "Tus respuestas reúnen señales frecuentes. Te recomendamos una evaluación para identificar el alérgeno y tratar la alergia de base.",
        },
      ],
    },
    lastReviewed: LAST_REVIEWED,
    reviewedBy: REVIEWED_BY,
  },
  {
    slug: "urticaria",
    title: "Urticaria",
    metaTitle: "Urticaria (ronchas) en Concepción · Bioalergia",
    metaDescription:
      "Ronchas y picazón en la piel en Concepción. Urticaria aguda y crónica: causas, diagnóstico y tratamiento con especialistas.",
    synonyms: ["ronchas", "habones", "urticaria crónica espontánea"],
    heroIntro:
      "La urticaria son ronchas (habones) que aparecen en la piel con picazón intensa y que cambian de lugar en horas. Puede ser aguda (menos de 6 semanas) o crónica, y no siempre se debe a una alergia.",
    sections: [
      {
        heading: "¿Qué es?",
        body: "Una reacción de la piel en que se liberan mediadores como la histamina, produciendo ronchas que pican y migran. A veces se acompaña de angioedema (hinchazón de labios o párpados).",
      },
      {
        heading: "Síntomas",
        body: "El signo característico es la roncha fugaz:",
        bullets: [
          "Ronchas rosadas o blanquecinas que pican.",
          "Cada lesión dura menos de 24 horas y cambia de lugar.",
          "A veces hinchazón de labios, párpados o manos (angioedema).",
        ],
      },
      {
        heading: "Causas y desencadenantes",
        body: "La urticaria aguda puede deberse a infecciones, medicamentos o alimentos. La urticaria crónica espontánea, en cambio, suele no tener un desencadenante alérgico identificable y puede tener un componente autoinmune.",
      },
      {
        heading: "Diagnóstico",
        body: "Es clínico y se apoya en la historia. En urticaria crónica pueden indicarse exámenes dirigidos como el test de suero autólogo (componente autoinmune) o el test del cubito de hielo (urticaria por frío).",
      },
      {
        heading: "Tratamiento",
        body: "La base son los antihistamínicos en dosis ajustada. En casos resistentes existen tratamientos avanzados, incluidos biológicos. Identificar y evitar gatillantes (cuando existen) es parte del manejo.",
      },
      {
        heading: "¿Cuándo consultar?",
        body: "Consulta si las ronchas se repiten por semanas, no responden a antihistamínicos o se acompañan de hinchazón de labios/lengua o dificultad para respirar (esto último es una urgencia).",
      },
    ],
    faq: [
      {
        question: "¿La urticaria siempre es por alergia a un alimento?",
        answer:
          "No. Es un mito frecuente. La mayoría de las urticarias crónicas no se deben a alimentos; suelen ser espontáneas y con frecuencia tienen un componente autoinmune.",
      },
      {
        question: "¿Qué es la urticaria crónica espontánea?",
        answer:
          "Es la aparición de ronchas casi a diario por más de seis semanas sin un desencadenante claro. Se controla con tratamiento y, en muchos casos, remite con el tiempo.",
      },
      {
        question: "¿Para qué sirve el test de suero autólogo?",
        answer:
          "Ayuda a orientar si hay un componente autoinmune en la urticaria crónica, lo que apoya decisiones de tratamiento.",
      },
      {
        question: "¿Cuándo la urticaria es una urgencia?",
        answer:
          "Si se acompaña de hinchazón de lengua o garganta, dificultad para respirar o mareo, puede ser una reacción grave: llama al 131 (SAMU) de inmediato.",
      },
    ],
    relatedExams: ["Test de suero autólogo", "Test del cubito de hielo"],
    quiz: {
      disclaimer: QUIZ_DISCLAIMER,
      questions: [
        {
          id: "ronchas",
          text: "¿Te aparecen ronchas con picazón que cambian de lugar en pocas horas?",
          options: [
            { label: "Sí, con frecuencia", score: 2 },
            { label: "Alguna vez", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "duracion",
          text: "¿Llevas más de seis semanas con brotes de ronchas?",
          options: [
            { label: "Sí", score: 2 },
            { label: "No estoy seguro/a", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "angioedema",
          text: "¿Has tenido hinchazón de labios o párpados?",
          options: [
            { label: "Sí", score: 2 },
            { label: "Una vez", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "respuesta",
          text: "¿Los antihistamínicos no controlan del todo las ronchas?",
          options: [
            { label: "Sí, persisten", score: 2 },
            { label: "Mejoran a medias", score: 1 },
            { label: "Las controlan / no he usado", score: 0 },
          ],
        },
      ],
      results: [
        {
          level: "bajo",
          upTo: 2,
          title: "Pocas señales de urticaria persistente",
          message:
            "Tus respuestas muestran un cuadro leve o aislado. Si las ronchas reaparecen, una consulta puede orientarte.",
        },
        {
          level: "posible",
          upTo: 5,
          title: "Hay señales que conviene evaluar",
          message:
            "Algunas respuestas sugieren urticaria que vale la pena estudiar para definir tipo y tratamiento.",
        },
        {
          level: "alto",
          upTo: null,
          title: "Señales compatibles con urticaria crónica",
          message:
            "Tus respuestas sugieren una urticaria persistente. Te recomendamos una evaluación; recuerda que ante hinchazón de garganta o ahogo debes llamar al 131.",
        },
      ],
    },
    lastReviewed: LAST_REVIEWED,
    reviewedBy: REVIEWED_BY,
  },
  {
    slug: "alergia-alimentaria",
    title: "Alergia alimentaria",
    metaTitle: "Alergia alimentaria en Concepción · Bioalergia",
    metaDescription:
      "Reacciones a alimentos en Concepción. Diagnóstico con prick test, IgE molecular (ALEX2) y provocación oral controlada para la alergia alimentaria.",
    synonyms: ["alergia a alimentos", "hipersensibilidad alimentaria"],
    heroIntro:
      "La alergia alimentaria es una reacción del sistema inmune frente a una proteína de un alimento. Puede ir desde síntomas leves hasta reacciones graves, por lo que un diagnóstico preciso es clave.",
    sections: [
      {
        heading: "¿Qué es?",
        body: "Una respuesta inmune (habitualmente mediada por IgE) frente a alimentos como leche, huevo, frutos secos, maní, pescados o mariscos. Es distinta de la intolerancia, que no involucra al sistema inmune.",
      },
      {
        heading: "Síntomas",
        body: "Aparecen minutos a un par de horas tras ingerir el alimento:",
        bullets: [
          "Ronchas, picazón o hinchazón de labios.",
          "Vómitos, dolor abdominal o diarrea.",
          "Tos, dificultad para respirar.",
          "En casos graves, anafilaxia (urgencia).",
        ],
      },
      {
        heading: "Causas y desencadenantes",
        body: "Los alimentos más frecuentes varían con la edad: en niños predominan leche, huevo y maní; en adultos, mariscos, pescados y frutos secos.",
      },
      {
        heading: "Diagnóstico",
        body: "Combina la historia clínica con prick test e IgE específica. El diagnóstico molecular (ALEX2) distingue sensibilizaciones genuinas de reacciones cruzadas y estima el riesgo. La provocación oral controlada es el examen de referencia para confirmar o descartar.",
      },
      {
        heading: "Tratamiento",
        body: "La base es evitar el alimento identificado y un plan de acción ante reacciones, que puede incluir adrenalina autoinyectable. En casos seleccionados existen protocolos de inducción de tolerancia bajo supervisión.",
      },
      {
        heading: "¿Cuándo consultar?",
        body: "Consulta si has tenido una reacción tras comer, si evitas alimentos 'por las dudas' o si necesitas confirmar con seguridad qué puedes comer. No suspendas grupos completos de alimentos sin evaluación.",
      },
    ],
    faq: [
      {
        question: "¿Alergia e intolerancia alimentaria son lo mismo?",
        answer:
          "No. La alergia involucra al sistema inmune y puede ser grave; la intolerancia (por ejemplo a la lactosa) es digestiva y no causa anafilaxia. El manejo es distinto.",
      },
      {
        question: "¿Qué es la provocación oral controlada?",
        answer:
          "Es la administración gradual y supervisada del alimento sospechoso en un entorno preparado. Es el examen de referencia para confirmar o descartar una alergia con seguridad.",
      },
      {
        question: "¿Un examen de sangre basta para diagnosticar?",
        answer:
          "No por sí solo. Una IgE positiva indica sensibilización, no necesariamente alergia clínica. Por eso se interpreta junto a la historia y, cuando corresponde, la provocación.",
      },
      {
        question: "¿La alergia alimentaria se supera?",
        answer:
          "Algunas, como a la leche o el huevo, suelen superarse en la infancia. Otras, como a maní o mariscos, tienden a persistir. El seguimiento define cada caso.",
      },
    ],
    relatedExams: [
      "Test ALEX2 — diagnóstico molecular",
      "Test cutáneo (Prick test)",
      "Prueba de provocación controlada",
    ],
    quiz: {
      disclaimer: QUIZ_DISCLAIMER,
      questions: [
        {
          id: "reaccion",
          text: "¿Has tenido ronchas, hinchazón o malestar poco después de comer un alimento?",
          options: [
            { label: "Sí, claramente", score: 2 },
            { label: "Es dudoso", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "repite",
          text: "¿Te ha pasado más de una vez con el mismo alimento?",
          options: [
            { label: "Sí", score: 2 },
            { label: "No estoy seguro/a", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "respiratorio",
          text: "¿Alguna reacción incluyó dificultad para respirar o hinchazón de labios/lengua?",
          options: [
            { label: "Sí", score: 2 },
            { label: "Leve", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "evita",
          text: "¿Evitas alimentos por miedo a reaccionar, sin confirmación médica?",
          options: [
            { label: "Sí", score: 2 },
            { label: "Alguno", score: 1 },
            { label: "No", score: 0 },
          ],
        },
      ],
      results: [
        {
          level: "bajo",
          upTo: 2,
          title: "Pocas señales de alergia alimentaria",
          message:
            "Tus respuestas muestran un riesgo bajo. Si tienes dudas con algún alimento, conviene aclararlas antes de restringir tu dieta.",
        },
        {
          level: "posible",
          upTo: 5,
          title: "Conviene estudiar tu caso",
          message:
            "Algunas respuestas sugieren una posible alergia alimentaria. Un estudio dirigido evita restricciones innecesarias y define qué es seguro comer.",
        },
        {
          level: "alto",
          upTo: null,
          title: "Señales compatibles con alergia alimentaria",
          message:
            "Tus respuestas reúnen señales relevantes. Te recomendamos una evaluación; si has tenido reacciones graves, no esperes y consulta pronto.",
        },
      ],
    },
    lastReviewed: LAST_REVIEWED,
    reviewedBy: REVIEWED_BY,
  },
  {
    slug: "alergia-a-medicamentos",
    title: "Alergia a medicamentos",
    metaTitle: "Alergia a medicamentos en Concepción · Bioalergia",
    metaDescription:
      "Reacciones a antibióticos, AINEs y anestésicos en Concepción. Estudio de alergia a medicamentos con pruebas intradérmicas y provocación controlada.",
    synonyms: ["alergia a fármacos", "reacción a medicamentos", "alergia a antibióticos"],
    heroIntro:
      "La alergia a medicamentos es una reacción del sistema inmune frente a un fármaco. Muchas etiquetas de 'alérgico' no se confirman al estudiarlas, lo que es importante porque evitar fármacos sin necesidad limita tratamientos.",
    sections: [
      {
        heading: "¿Qué es?",
        body: "Una reacción de hipersensibilidad a un medicamento, que puede ser inmediata (minutos a horas) o tardía (días). Los fármacos más implicados son los betalactámicos (penicilinas), los AINEs y los anestésicos.",
      },
      {
        heading: "Síntomas",
        body: "Varían según el tipo de reacción:",
        bullets: [
          "Ronchas, picazón o hinchazón.",
          "Erupciones en la piel (a veces tardías).",
          "Dificultad para respirar o anafilaxia (urgencia).",
        ],
      },
      {
        heading: "Causas y desencadenantes",
        body: "Antibióticos betalactámicos, antiinflamatorios (AINEs), anestésicos, medios de contraste, quimioterápicos y biológicos están entre los más frecuentes.",
      },
      {
        heading: "Diagnóstico",
        body: "Incluye una historia detallada, pruebas cutáneas e intradérmicas y, cuando es seguro, una provocación controlada para confirmar tolerancia. El estudio permite 'desetiquetar' alergias no confirmadas y recuperar opciones de tratamiento.",
      },
      {
        heading: "Tratamiento",
        body: "Lo central es identificar el fármaco responsable y las alternativas seguras. En situaciones donde el medicamento es imprescindible, existen protocolos de desensibilización bajo estricta supervisión.",
      },
      {
        heading: "¿Cuándo consultar?",
        body: "Consulta si te han dicho que eres alérgico a un medicamento, si tuviste una reacción y no sabes a qué fármaco, o antes de una cirugía si tienes antecedentes de reacciones.",
      },
    ],
    faq: [
      {
        question: "Me dijeron que soy alérgico a la penicilina, ¿es para siempre?",
        answer:
          "No necesariamente. Muchas etiquetas de alergia a penicilina no se confirman al estudiarlas o se pierden con los años. Un estudio dirigido puede devolverte el acceso a este antibiótico.",
      },
      {
        question: "¿Es peligroso hacer el estudio?",
        answer:
          "Se realiza por etapas, de menor a mayor, bajo supervisión médica con monitorización y todo lo necesario para actuar ante una reacción. La seguridad es prioritaria.",
      },
      {
        question: "¿Qué hago mientras tanto?",
        answer:
          "Evita el fármaco sospechoso y avisa a todos tus médicos. Lleva contigo la información de la reacción. No vuelvas a usar el medicamento sin evaluación.",
      },
      {
        question: "¿La alergia a un AINE significa que no puedo usar ninguno?",
        answer:
          "No siempre. El estudio puede identificar antiinflamatorios alternativos que toleras, lo que es clave para el manejo del dolor.",
      },
    ],
    relatedExams: ["Prueba intradérmica", "Prueba de provocación controlada"],
    quiz: {
      disclaimer: QUIZ_DISCLAIMER,
      questions: [
        {
          id: "reaccion",
          text: "¿Has tenido ronchas, hinchazón o erupción tras tomar un medicamento?",
          options: [
            { label: "Sí", score: 2 },
            { label: "Es dudoso", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "cual",
          text: "¿Sabes qué medicamento provocó la reacción?",
          options: [
            { label: "No, varios posibles", score: 2 },
            { label: "Más o menos", score: 1 },
            { label: "Sí, lo tengo claro", score: 0 },
          ],
        },
        {
          id: "grave",
          text: "¿Alguna reacción incluyó dificultad para respirar o mareo?",
          options: [
            { label: "Sí", score: 2 },
            { label: "Leve", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "etiqueta",
          text: "¿Evitas un medicamento porque 'te dijeron' que eres alérgico, sin estudio?",
          options: [
            { label: "Sí", score: 2 },
            { label: "Quizás", score: 1 },
            { label: "No", score: 0 },
          ],
        },
      ],
      results: [
        {
          level: "bajo",
          upTo: 2,
          title: "Pocas señales de alergia a medicamentos",
          message:
            "Tus respuestas muestran un riesgo bajo. Ante cualquier duda con un fármaco, coméntalo con tu médico.",
        },
        {
          level: "posible",
          upTo: 5,
          title: "Conviene estudiar tu caso",
          message:
            "Algunas respuestas sugieren que vale la pena un estudio para confirmar o descartar la alergia y recuperar opciones de tratamiento.",
        },
        {
          level: "alto",
          upTo: null,
          title: "Señales que ameritan evaluación",
          message:
            "Tus respuestas reúnen señales relevantes. Un estudio dirigido puede aclarar qué fármaco evitar y cuáles son seguros para ti.",
        },
      ],
    },
    lastReviewed: LAST_REVIEWED,
    reviewedBy: REVIEWED_BY,
  },
  {
    slug: "anafilaxia",
    title: "Anafilaxia",
    metaTitle: "Anafilaxia en Concepción · Bioalergia",
    metaDescription:
      "La anafilaxia es una reacción alérgica grave y una urgencia médica. Reconócela, usa adrenalina y llama al 131. Estudio y plan de acción en Concepción.",
    synonyms: ["reacción alérgica grave", "shock anafiláctico"],
    heroIntro:
      "La anafilaxia es una reacción alérgica grave, de inicio rápido, que puede poner en riesgo la vida. Es una urgencia médica: el tratamiento de elección es la adrenalina intramuscular y llamar al 131 (SAMU).",
    sections: [
      {
        heading: "Es una urgencia médica",
        body: "Ante una reacción grave, actúa de inmediato:",
        bullets: [
          "Usa adrenalina intramuscular (autoinyector) si la tienes indicada.",
          "Llama al 131 (SAMU) sin demora.",
          "Recuesta a la persona con las piernas elevadas (si respira bien).",
          "El antihistamínico NO reemplaza a la adrenalina.",
        ],
      },
      {
        heading: "¿Qué es?",
        body: "Una reacción alérgica generalizada que afecta a dos o más sistemas del cuerpo (piel, respiratorio, digestivo, circulatorio) y progresa rápido. Sin tratamiento puede ser mortal.",
      },
      {
        heading: "Síntomas",
        body: "Aparecen minutos después de la exposición:",
        bullets: [
          "Ronchas o hinchazón con dificultad para respirar.",
          "Sensación de cierre de garganta, voz ronca.",
          "Mareo, desmayo o caída de presión.",
          "Vómitos o dolor abdominal intenso.",
        ],
      },
      {
        heading: "Causas y desencadenantes",
        body: "Los más frecuentes son alimentos (maní, frutos secos, mariscos), medicamentos y picaduras de himenópteros (abeja, avispa).",
      },
      {
        heading: "Después de la urgencia: el estudio",
        body: "Tras una anafilaxia es fundamental estudiar la causa con un especialista (prick test, IgE específica, intradérmica) para identificar el desencadenante, entregar un plan de acción y prescribir adrenalina autoinyectable.",
      },
      {
        heading: "¿Cuándo consultar?",
        body: "Si has tenido una reacción grave alguna vez, consulta para definir la causa y tu plan. Si estás teniendo una reacción grave ahora, no leas: usa adrenalina y llama al 131.",
      },
    ],
    faq: [
      {
        question: "¿Qué hago si alguien tiene anafilaxia?",
        answer:
          "Aplica adrenalina intramuscular si está disponible, llama al 131 (SAMU) de inmediato y mantén a la persona recostada. No esperes a ver si mejora sola y no uses solo antihistamínico.",
      },
      {
        question: "¿Por qué la adrenalina y no un antihistamínico?",
        answer:
          "La adrenalina es el único tratamiento que revierte rápidamente la anafilaxia. El antihistamínico solo alivia síntomas leves de piel y no actúa sobre la vía aérea ni la presión.",
      },
      {
        question: "¿Tras una anafilaxia debo ir igual al hospital?",
        answer:
          "Sí, siempre. Los síntomas pueden reaparecer horas después (reacción bifásica), por lo que se requiere observación médica aunque hayas mejorado.",
      },
      {
        question: "¿Puedo prevenir nuevas anafilaxias?",
        answer:
          "Sí. Identificar y evitar el desencadenante, portar adrenalina autoinyectable y tener un plan de acción reducen mucho el riesgo. El estudio alérgico es clave.",
      },
    ],
    relatedExams: [
      "Test cutáneo (Prick test)",
      "Prueba intradérmica",
      "Test ALEX2 — diagnóstico molecular",
    ],
    quiz: {
      disclaimer: QUIZ_DISCLAIMER,
      questions: [
        {
          id: "grave",
          text: "¿Has tenido una reacción con dificultad para respirar o hinchazón de garganta?",
          options: [
            { label: "Sí", score: 2 },
            { label: "Algo parecido", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "rapida",
          text: "¿La reacción apareció pocos minutos después de un alimento, fármaco o picadura?",
          options: [
            { label: "Sí", score: 2 },
            { label: "No estoy seguro/a", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "sistemas",
          text: "¿Tuviste a la vez síntomas de piel y de otro tipo (respiratorio, mareo, vómitos)?",
          options: [
            { label: "Sí", score: 2 },
            { label: "Quizás", score: 1 },
            { label: "No", score: 0 },
          ],
        },
        {
          id: "plan",
          text: "¿Tienes identificada la causa y un plan con adrenalina?",
          options: [
            { label: "No", score: 2 },
            { label: "En parte", score: 1 },
            { label: "Sí", score: 0 },
          ],
        },
      ],
      results: [
        {
          level: "bajo",
          upTo: 2,
          title: "Sin señales claras de anafilaxia previa",
          message:
            "Tus respuestas no sugieren reacciones graves. Si alguna vez tienes ahogo o hinchazón de garganta, es una urgencia: llama al 131.",
        },
        {
          level: "posible",
          upTo: 5,
          title: "Conviene evaluar tu antecedente",
          message:
            "Algunas respuestas sugieren una posible reacción grave. Un estudio puede identificar la causa y darte un plan de acción.",
        },
        {
          level: "alto",
          upTo: null,
          title: "Antecedentes compatibles con anafilaxia",
          message:
            "Tus respuestas sugieren reacciones graves sin un plan definido. Te recomendamos una evaluación pronto para identificar el desencadenante y prescribir adrenalina. Ante una reacción en curso, llama al 131.",
        },
      ],
    },
    lastReviewed: LAST_REVIEWED,
    reviewedBy: REVIEWED_BY,
  },
];

export function getCondition(slug: string): Condition | undefined {
  return conditions.find((c) => c.slug === slug);
}
