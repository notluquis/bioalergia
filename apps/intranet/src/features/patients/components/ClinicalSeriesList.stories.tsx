import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import { ClinicalSeriesList } from "./ClinicalSeriesList";

// Stories for the patient-scoped clinical series panel. Mirrors
// SkinTestsList: thin wrapper around `getClinicalSeries` feeding the same
// DataTable component with kind + status chips.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

const SERIES = [
  {
    id: 11,
    kind: "SUBCUTANEOUS_TREATMENT",
    displayName: "Inmunoterapia ácaros — vial 4",
    patientName: "Camila Andrea Soto Vera",
    status: "ACTIVE",
    eventsCount: 18,
    skinTestsCount: 1,
    createdAt: "2025-11-04",
  },
  {
    id: 12,
    kind: "SKIN_TEST",
    displayName: "Panel inhalantes — control anual",
    patientName: "Camila Andrea Soto Vera",
    status: "COMPLETED",
    eventsCount: 1,
    skinTestsCount: 1,
    createdAt: "2026-04-21",
  },
  {
    id: 13,
    kind: "PATCH_TEST",
    displayName: "Parche europeo extendido",
    patientName: "Camila Andrea Soto Vera",
    status: "PLANNED",
    eventsCount: 3,
    skinTestsCount: 1,
    createdAt: "2026-05-01",
  },
  {
    id: 14,
    kind: "SUBCUTANEOUS_TREATMENT",
    displayName: "Inmunoterapia gramíneas — descontinuada",
    patientName: "Camila Andrea Soto Vera",
    status: "CANCELLED",
    eventsCount: 4,
    skinTestsCount: 0,
    createdAt: "2024-08-10",
  },
];

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

const meta: Meta<typeof ClinicalSeriesList> = {
  title: "Patients/ClinicalSeriesList",
  component: ClinicalSeriesList,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Series clínicas vinculadas a un paciente (inmunoterapia, prick test, parche). Muestra kind + estado con chips coloreados.",
      },
    },
    msw: {
      handlers: [
        http.post("*/api/orpc/patients/rpc/getClinicalSeries", () => ok({ items: SERIES })),
      ],
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={makeQueryClient()}>
        <div className="max-w-4xl">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ClinicalSeriesList>;

// Default: four series mixing kinds and statuses (active, completada,
// planificada, cancelada) so every chip color is exercised.
export const Populated: Story = {
  render: () => <ClinicalSeriesList patientId={42} />,
};

// Empty state: paciente sin series clínicas registradas.
export const Empty: Story = {
  render: () => <ClinicalSeriesList patientId={42} />,
  parameters: {
    msw: {
      handlers: [http.post("*/api/orpc/patients/rpc/getClinicalSeries", () => ok({ items: [] }))],
    },
  },
};

// Loading: spinner mientras la query se resuelve.
export const Loading: Story = {
  render: () => <ClinicalSeriesList patientId={42} />,
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/patients/rpc/getClinicalSeries", async () => {
          await new Promise((resolve) => setTimeout(resolve, 60_000));
          return ok({ items: [] });
        }),
      ],
    },
  },
};

// Single active series — caso más común durante seguimiento de un paciente
// en tratamiento subcutáneo de mantenimiento.
export const SingleActive: Story = {
  render: () => <ClinicalSeriesList patientId={42} />,
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/patients/rpc/getClinicalSeries", () => ok({ items: [SERIES[0]] })),
      ],
    },
  },
};
