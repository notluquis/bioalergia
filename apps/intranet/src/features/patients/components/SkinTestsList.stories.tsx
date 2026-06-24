import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import { SkinTestsList } from "./SkinTestsList";

// Stories for the patient-scoped skin-test panel. The component is a thin
// wrapper around `getSkinTests` (oRPC patients router) feeding a DataTable.
// MSW intercepts the call so we can exercise loading / populated / empty
// without a backend.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

const TESTS = [
  {
    id: 1,
    testDate: "2026-04-21",
    panelTitle: "Panel inhalantes Santiago",
    seriesKind: "SKIN_TEST",
    resultsCount: 14,
    physicianName: "Dra. Macarena Vidal",
  },
  {
    id: 2,
    testDate: "2026-03-10",
    panelTitle: "Parche europeo extendido",
    seriesKind: "PATCH_TEST",
    resultsCount: 32,
    physicianName: "Dr. Sebastián Rojas",
  },
  {
    id: 3,
    testDate: "2025-12-02",
    panelTitle: "Inmunoterapia subcutánea — control",
    seriesKind: "SUBCUTANEOUS_TREATMENT",
    resultsCount: 6,
    physicianName: null,
  },
];

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

const baseHandlers = [
  http.post("*/api/orpc/patients/rpc/getSkinTests", () => ok({ items: TESTS })),
];

const meta: Meta<typeof SkinTestsList> = {
  title: "Patients/SkinTestsList",
  component: SkinTestsList,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Listado de tests cutáneos vinculados a un paciente. Render directo de `getSkinTests` con tipo (Test/Parche/Subcutáneo) coloreado por chip.",
      },
    },
    msw: { handlers: baseHandlers },
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
type Story = StoryObj<typeof SkinTestsList>;

// Default: three tests across the three series kinds.
export const Populated: Story = {
  render: () => <SkinTestsList patientId={42} />,
};

// Empty state: backend returns no items, table shows the no-data message.
export const Empty: Story = {
  render: () => <SkinTestsList patientId={42} />,
  parameters: {
    msw: {
      handlers: [http.post("*/api/orpc/patients/rpc/getSkinTests", () => ok({ items: [] }))],
    },
  },
};

// Loading: handler delays so the spinner branch renders.
export const Loading: Story = {
  render: () => <SkinTestsList patientId={42} />,
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/patients/rpc/getSkinTests", async () => {
          await new Promise((resolve) => setTimeout(resolve, 60_000));
          return ok({ items: [] });
        }),
      ],
    },
  },
};

// Single result, no physician on file — exercises the "—" fallback.
export const SingleNoPhysician: Story = {
  render: () => <SkinTestsList patientId={42} />,
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/patients/rpc/getSkinTests", () =>
          ok({
            items: [
              {
                id: 99,
                testDate: "2026-05-02",
                panelTitle: "Panel alimentos pediátrico",
                seriesKind: "SKIN_TEST",
                resultsCount: 8,
                physicianName: null,
              },
            ],
          })
        ),
      ],
    },
  },
};
