export interface QuizOption {
  label: string;
  score: number;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: QuizOption[];
}

export type QuizResultLevel = "bajo" | "posible" | "alto";

export interface QuizResult {
  level: QuizResultLevel;
  /** Puntaje máximo (inclusivo) que cubre este tramo; `null` = tramo superior. */
  upTo: number | null;
  title: string;
  message: string;
}

export interface QuizContent {
  disclaimer: string;
  questions: QuizQuestion[];
  results: QuizResult[];
}

export const quizContent: QuizContent = {
  disclaimer:
    "Estas preguntas y sus resultados son meramente referenciales y en ningún caso constituyen un diagnóstico médico. Solo un profesional de la salud puede evaluar tu caso.",
  questions: [
    {
      id: "nasal",
      text: "¿Tienes estornudos, secreción o congestión nasal que se prolongan por dos semanas o más, sin estar resfriado?",
      options: [
        { label: "Sí, con frecuencia", score: 2 },
        { label: "A veces", score: 1 },
        { label: "No", score: 0 },
      ],
    },
    {
      id: "ocular",
      text: "¿Sientes picazón o lagrimeo en los ojos junto con esos síntomas nasales?",
      options: [
        { label: "Sí", score: 2 },
        { label: "A veces", score: 1 },
        { label: "No", score: 0 },
      ],
    },
    {
      id: "estacional",
      text: "¿Notas que tus síntomas empeoran en alguna estación del año, como primavera u otoño?",
      options: [
        { label: "Sí, claramente", score: 2 },
        { label: "No estoy seguro/a", score: 1 },
        { label: "No", score: 0 },
      ],
    },
    {
      id: "ambiental",
      text: "¿Aparecen o se intensifican tus molestias con el polvo de casa, espacios cerrados, pólenes o el contacto con animales?",
      options: [
        { label: "Sí", score: 2 },
        { label: "A veces", score: 1 },
        { label: "No", score: 0 },
      ],
    },
    {
      id: "piel",
      text: "¿Te aparecen ronchas, picazón en la piel de forma recurrente o tienes eczema (dermatitis)?",
      options: [
        { label: "Sí", score: 2 },
        { label: "A veces", score: 1 },
        { label: "No", score: 0 },
      ],
    },
    {
      id: "alimentos",
      text: "¿Has tenido reacciones a algún alimento o medicamento (hinchazón, ronchas, malestar)?",
      options: [
        { label: "Sí", score: 2 },
        { label: "Es dudoso / no lo tengo claro", score: 1 },
        { label: "No", score: 0 },
      ],
    },
    {
      id: "diagnostico",
      text: "¿Te han diagnosticado antes rinitis alérgica, asma o dermatitis?",
      options: [
        { label: "Sí", score: 2 },
        { label: "No", score: 0 },
      ],
    },
    {
      id: "familia",
      text: "¿Hay antecedentes de alergia, asma o eczema en tu familia cercana?",
      options: [
        { label: "Sí", score: 2 },
        { label: "No lo sé", score: 1 },
        { label: "No", score: 0 },
      ],
    },
  ],
  results: [
    {
      level: "bajo",
      upTo: 4,
      title: "Pocas señales de alergia por ahora",
      message:
        "Tus respuestas muestran pocos síntomas compatibles con una alergia. Si igual notas molestias que te incomodan o que reaparecen, conversarlo con un especialista siempre es una buena idea para quedar tranquilo/a.",
    },
    {
      level: "posible",
      upTo: 9,
      title: "Hay señales que vale la pena revisar",
      message:
        "Algunas de tus respuestas son compatibles con una posible alergia. Una evaluación médica puede ayudarte a entender qué las causa y a definir si necesitas estudios o tratamiento. No tienes que convivir con las molestias.",
    },
    {
      level: "alto",
      upTo: null,
      title: "Varias señales compatibles con alergia",
      message:
        "Tus respuestas reúnen varias señales frecuentes en personas con alergia. Te recomendamos agendar una evaluación con un especialista: con el estudio adecuado es posible identificar los desencadenantes y diseñar un tratamiento a tu medida.",
    },
  ],
};
