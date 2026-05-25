import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import { PatientRecordsTimeline } from "./PatientRecordsTimeline";

// Stories for the patient ficha clínica timeline. Component reads from
// `clinicalRecords.listForPatient` via TanStack Query and renders a stack
// of RecordCards. We intercept the contract per story to surface the four
// states the operator might see.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

const RECORDS = [
  {
    id: "rec-2026-04",
    consultDate: "2026-04-15",
    patientName: "Camila Andrea Soto Vera",
    ageLabel: "8 años 3 meses",
    history:
      "Control de inmunoterapia subcutánea — vial 4. Sin reacciones sistémicas en últimas 6 dosis.",
    physicalExam: "Buen estado general. Auscultación pulmonar sin sibilancias.",
    diagnosis: "Rinitis alérgica persistente moderada en tratamiento.",
    indications: [
      "Continuar inmunoterapia — próxima dosis en 7 días.",
      "Loratadina 5 mg vía oral 1 vez al día.",
    ],
    antecedents: {
      personal: ["Dermatitis atópica leve", "Rinitis alérgica desde los 4 años"],
      family: ["Madre con asma"],
    },
    medications: ["Loratadina 5 mg", "Mometasona spray nasal"],
    knownAllergies: ["Ácaros del polvo", "Polen de gramíneas"],
    observations: "Adherencia excelente.",
    weightKg: 28.4,
    heightCm: 130,
    headCircumferenceCm: 52,
    anthropometric: { "P/E": "P50", IMC: "16.8" },
  },
  {
    id: "rec-2026-01",
    consultDate: "2026-01-12",
    patientName: "Camila Andrea Soto Vera",
    ageLabel: "8 años",
    history: "Inicio de inmunoterapia subcutánea — vial 1.",
    physicalExam: null,
    diagnosis: "Rinitis alérgica persistente moderada.",
    indications: ["Iniciar inmunoterapia en consultorio — esquema convencional."],
    antecedents: null,
    medications: ["Loratadina 5 mg"],
    knownAllergies: ["Ácaros del polvo"],
    observations: null,
    weightKg: 27.8,
    heightCm: 128,
    headCircumferenceCm: null,
    anthropometric: {},
  },
];

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

const meta: Meta<typeof PatientRecordsTimeline> = {
  title: "ClinicalRecords/PatientRecordsTimeline",
  component: PatientRecordsTimeline,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Timeline de fichas clínicas de un paciente. Render directo de `clinicalRecords.listForPatient` con un RecordCard por consulta importada desde OneDrive.",
      },
    },
    msw: {
      handlers: [
        http.post("*/api/orpc/clinicalRecords/rpc/listForPatient", () => ok({ records: RECORDS })),
      ],
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={makeQueryClient()}>
        <div className="max-w-3xl">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PatientRecordsTimeline>;

// Default: dos consultas, ordenadas como llegan del backend.
export const Populated: Story = {
  render: () => <PatientRecordsTimeline patientId={42} />,
};

// Empty: paciente sin fichas importadas.
export const Empty: Story = {
  render: () => <PatientRecordsTimeline patientId={42} />,
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/clinicalRecords/rpc/listForPatient", () => ok({ records: [] })),
      ],
    },
  },
};

// Loading: spinner mientras la query no resuelve.
export const Loading: Story = {
  render: () => <PatientRecordsTimeline patientId={42} />,
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/clinicalRecords/rpc/listForPatient", async () => {
          await new Promise((resolve) => setTimeout(resolve, 60_000));
          return ok({ records: [] });
        }),
      ],
    },
  },
};

// patientId null: el componente retorna null (rama defensiva).
export const NoPatient: Story = {
  render: () => (
    <div className="space-y-2">
      <p className="text-default-600 text-sm">
        Sin patientId — el componente no renderiza nada (return null).
      </p>
      <PatientRecordsTimeline patientId={null} />
    </div>
  ),
};
