// Diagnósticos de alergia frecuentes — atajos de búsqueda, NO códigos.
//
// Cada item es una CONSULTA en lenguaje clínico que se inyecta al buscador
// oficial CIE-11 (ECT) al seleccionarlo; WHO devuelve el código real. Así no
// inventamos códigos CIE-11 y el resultado siempre es oficial/actualizado.
//
// Las secciones espejan las categorías clínicas con que trabaja la consulta.
// Editable: el dr puede dictar/ajustar su lista real.

export type FrequentDiagnosis = {
  /** id estable para el ComboBox. */
  id: string;
  /** Texto mostrado y consulta enviada al ECT. */
  label: string;
  /** Sección (Header no seleccionable) que agrupa el item. */
  category: string;
};

export const FREQUENT_DIAGNOSIS_SECTIONS: { category: string; items: FrequentDiagnosis[] }[] = [
  {
    category: "Respiratorio",
    items: [
      { id: "freq-rinitis-alergica", label: "Rinitis alérgica", category: "Respiratorio" },
      {
        id: "freq-rinoconjuntivitis",
        label: "Rinoconjuntivitis alérgica",
        category: "Respiratorio",
      },
      { id: "freq-asma-alergica", label: "Asma alérgica", category: "Respiratorio" },
      { id: "freq-asma", label: "Asma", category: "Respiratorio" },
    ],
  },
  {
    category: "Piel",
    items: [
      { id: "freq-urticaria", label: "Urticaria", category: "Piel" },
      { id: "freq-dermatitis-atopica", label: "Dermatitis atópica", category: "Piel" },
      { id: "freq-angioedema", label: "Angioedema", category: "Piel" },
      { id: "freq-eccema", label: "Eccema", category: "Piel" },
    ],
  },
  {
    category: "Anafilaxia y reacciones",
    items: [
      { id: "freq-anafilaxia", label: "Anafilaxia", category: "Anafilaxia y reacciones" },
      {
        id: "freq-reaccion-alergica",
        label: "Reacción alérgica",
        category: "Anafilaxia y reacciones",
      },
    ],
  },
  {
    category: "Alergia alimentaria",
    items: [
      {
        id: "freq-alergia-alimentaria",
        label: "Alergia alimentaria",
        category: "Alergia alimentaria",
      },
      {
        id: "freq-alergia-frutos-secos",
        label: "Alergia a frutos secos",
        category: "Alergia alimentaria",
      },
      { id: "freq-alergia-mariscos", label: "Alergia a mariscos", category: "Alergia alimentaria" },
      { id: "freq-alergia-leche", label: "Alergia a la leche", category: "Alergia alimentaria" },
      { id: "freq-alergia-huevo", label: "Alergia al huevo", category: "Alergia alimentaria" },
    ],
  },
  {
    category: "Alergia a medicamentos",
    items: [
      {
        id: "freq-alergia-penicilina",
        label: "Alergia a la penicilina",
        category: "Alergia a medicamentos",
      },
      {
        id: "freq-alergia-medicamentos",
        label: "Alergia a medicamentos",
        category: "Alergia a medicamentos",
      },
      { id: "freq-alergia-aines", label: "Alergia a AINEs", category: "Alergia a medicamentos" },
    ],
  },
  {
    category: "Contacto y sensibilización",
    items: [
      {
        id: "freq-dermatitis-contacto",
        label: "Dermatitis alérgica de contacto",
        category: "Contacto y sensibilización",
      },
      {
        id: "freq-conjuntivitis-alergica",
        label: "Conjuntivitis alérgica",
        category: "Contacto y sensibilización",
      },
    ],
  },
];

/** Lookup id -> label para resolver la consulta al seleccionar en el ComboBox. */
export const FREQUENT_DIAGNOSIS_BY_ID: Record<string, string> = Object.fromEntries(
  FREQUENT_DIAGNOSIS_SECTIONS.flatMap((section) =>
    section.items.map((item) => [item.id, item.label])
  )
);
