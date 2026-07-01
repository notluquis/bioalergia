import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import { DoctoraliaAppointmentsList } from "./DoctoraliaAppointmentsList";

// Stories for the patient-scoped Doctoralia appointments panel. Thin wrapper
// over `getDoctoraliaAppointments` (oRPC patients router). MSW intercepts the
// call so loading / populated / empty render without a backend.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

const APPTS = [
  {
    id: 1,
    title: "Fiorangela Venturelli",
    startAt: "2026-04-21T15:45:00.000Z",
    endAt: "2026-04-21T16:25:00.000Z",
    serviceName: "Visitas Sucesivas Consulta Inmunólogo Alergólogo",
    insuranceName: "Fonasa",
    comments: "abono 25\nedad. 22 años",
    attendance: 1,
    status: 6,
  },
  {
    id: 2,
    title: "Fiorangela Venturelli",
    startAt: "2026-02-10T13:00:00.000Z",
    endAt: "2026-02-10T13:40:00.000Z",
    serviceName: "Primera Consulta Inmunólogo Alergólogo",
    insuranceName: null,
    comments: null,
    attendance: 2,
    status: 6,
  },
];

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

const handler = (data: unknown) =>
  http.post("*/api/orpc/patients/rpc/getDoctoraliaAppointments", () => ok(data));

const meta: Meta<typeof DoctoraliaAppointmentsList> = {
  title: "Patients/DoctoraliaAppointmentsList",
  component: DoctoraliaAppointmentsList,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Citas de Doctoralia vinculadas a un paciente (via el feeder de identidad). Chip de asistencia (asistió / no asistió) + comentarios libres.",
      },
    },
    msw: { handlers: [handler({ items: APPTS })] },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={makeQueryClient()}>
        <div className="max-w-2xl">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DoctoraliaAppointmentsList>;

export const Populated: Story = {
  render: () => <DoctoraliaAppointmentsList patientId={42} />,
};

export const Empty: Story = {
  render: () => <DoctoraliaAppointmentsList patientId={42} />,
  parameters: { msw: { handlers: [handler({ items: [] })] } },
};

export const Loading: Story = {
  render: () => <DoctoraliaAppointmentsList patientId={42} />,
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/patients/rpc/getDoctoraliaAppointments", async () => {
          await new Promise((resolve) => setTimeout(resolve, 60_000));
          return ok({ items: [] });
        }),
      ],
    },
  },
};
