import type { Meta, StoryObj } from "@storybook/react-vite";

import { RecordCard } from "./RecordCard";

// Stories for the consultation card. RecordCard is fully presentational —
// no queries, no router — so we can drive every section by passing props
// directly. Variants exercise (a) full ficha pediátrica con antropométricos,
// (b) ficha mínima con solo motivo + diagnóstico, (c) ficha con alergias y
// medicamentos resaltados, (d) sin fecha (estado defensivo).

const meta: Meta<typeof RecordCard> = {
  title: "ClinicalRecords/RecordCard",
  component: RecordCard,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Tarjeta de consulta única dentro de la ficha clínica del paciente. Renderiza secciones condicionales: historia, antecedentes (personales/familiares), alergias conocidas, examen físico, diagnóstico, medicamentos, indicaciones y observaciones, más chips antropométricos (peso/talla/CC).",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-3xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof RecordCard>;

// Ficha completa de control pediátrico.
export const FullPediatric: Story = {
  args: {
    consultDate: "2026-04-15",
    patientName: "Camila Andrea Soto Vera",
    ageLabel: "8 años 3 meses",
    history:
      "Consulta de control de inmunoterapia subcutánea. Tolerancia adecuada a vial 4. Sin reacciones sistémicas en últimas 6 dosis.",
    physicalExam:
      "Buen estado general. Faringe sin congestión. Auscultación pulmonar sin sibilancias.",
    diagnosis: "Rinitis alérgica persistente moderada en tratamiento.",
    indications: [
      "Continuar inmunoterapia subcutánea — próxima dosis en 7 días.",
      "Loratadina 5 mg vía oral 1 vez al día por 30 días.",
      "Lavado nasal con suero fisiológico 2 veces al día.",
    ],
    antecedents: {
      personal: ["Dermatitis atópica leve", "Rinitis alérgica desde los 4 años"],
      family: ["Madre con asma", "Padre con rinitis alérgica"],
    },
    medications: ["Loratadina 5 mg", "Mometasona spray nasal"],
    knownAllergies: ["Ácaros del polvo (Dermatophagoides pteronyssinus)", "Polen de gramíneas"],
    observations: "Adherencia excelente. Familia muy comprometida con el tratamiento.",
    weightKg: 28.4,
    heightCm: 130,
    headCircumferenceCm: 52,
    anthropometric: {
      "P/E": "P50",
      "T/E": "P75",
      IMC: "16.8",
      "P/T": "P40",
    },
  },
};

// Ficha mínima — solo lo obligatorio.
export const Minimal: Story = {
  args: {
    consultDate: "2026-05-02",
    patientName: "Joaquín Reyes",
    ageLabel: null,
    history: null,
    physicalExam: null,
    diagnosis: "Urticaria aguda en estudio.",
    indications: [],
    antecedents: null,
    medications: [],
    knownAllergies: [],
    observations: null,
    weightKg: null,
    heightCm: null,
    headCircumferenceCm: null,
    anthropometric: {},
  },
};

// Ficha con énfasis en alergias y medicamentos (riesgo).
export const HighRiskAllergies: Story = {
  args: {
    consultDate: "2026-05-10",
    patientName: "Felipe Castillo",
    ageLabel: "32 años",
    history: "Anafilaxia por maní hace 2 años. Trae epipen.",
    physicalExam: "Sin lesiones cutáneas activas.",
    diagnosis: "Alergia alimentaria a maní y frutos secos. Riesgo anafiláctico.",
    indications: [
      "Portar adrenalina autoinyectable 0.3 mg en todo momento.",
      "Evitar productos sin etiqueta clara.",
      "Plan de acción anafilaxia entregado.",
    ],
    antecedents: {
      personal: ["Asma leve persistente"],
      family: [],
    },
    medications: ["Salbutamol inhalador SOS", "Adrenalina autoinyectable 0.3 mg"],
    knownAllergies: ["Maní", "Nueces", "Almendras", "Avellanas"],
    observations: "Paciente educado en lectura de etiquetas.",
    weightKg: 78,
    heightCm: 178,
    headCircumferenceCm: null,
    anthropometric: { IMC: "24.6" },
  },
};

// Defensive state: sin fecha de consulta — encabezado muestra "Sin fecha".
export const NoDate: Story = {
  args: {
    consultDate: null,
    patientName: null,
    ageLabel: null,
    history: "Ficha importada sin fecha del documento original.",
    physicalExam: null,
    diagnosis: null,
    indications: [],
    antecedents: null,
    medications: [],
    knownAllergies: [],
    observations: null,
    weightKg: null,
    heightCm: null,
    headCircumferenceCm: null,
    anthropometric: {},
  },
};
