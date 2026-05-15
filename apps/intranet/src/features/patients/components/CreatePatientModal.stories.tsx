import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { Button } from "@heroui/react";

import { CreatePatientModal } from "./CreatePatientModal";

// Stories for the patient registration modal. The form does live RUT
// validation and dedup via two oRPC lookups:
//   * `people.findByRut` — checks if the RUT already maps to a Person.
//   * `patients.list` — fuzzy-matches names to surface "similar" patients.
// Both are mocked per-story so we can exercise: clean form, "person ya
// existe sin perfil de paciente", and "ya es paciente" guards.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

const NEW_PATIENT_RESPONSE = {
  patient: {
    id: 1234,
    personId: 555,
    birthDate: null,
    bloodType: null,
    notes: null,
    createdAt: new Date("2026-05-12T10:00:00Z"),
    updatedAt: new Date("2026-05-12T10:00:00Z"),
    person: {
      id: 555,
      rut: "16.987.654-3",
      names: "Camila Andrea",
      fatherName: "Soto",
      motherName: "Vera",
      email: "camila.soto@example.cl",
      phone: "+56 9 8765 4321",
      personType: "NATURAL",
      createdAt: new Date("2026-05-12T10:00:00Z"),
      updatedAt: new Date("2026-05-12T10:00:00Z"),
    },
  },
};

// Default handlers: no person matches, no similar patients. Form starts
// clean and submit succeeds.
const baseHandlers = [
  http.post("*/api/orpc/people/rpc/findByRut", () => ok({ person: null })),
  http.post("*/api/orpc/patients/rpc/list", () => ok({ patients: [] })),
  http.post("*/api/orpc/patients/rpc/create", () => ok(NEW_PATIENT_RESPONSE)),
];

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

function ModalHarness() {
  const [open, setOpen] = useState(true);
  return (
    <div className="p-8">
      <Button onPress={() => setOpen(true)}>Abrir modal</Button>
      <CreatePatientModal isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
}

const meta: Meta<typeof CreatePatientModal> = {
  title: "Patients/CreatePatientModal",
  component: CreatePatientModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Modal de registro de pacientes con validación de RUT (algoritmo módulo 11), deduplicación por RUT (people.findByRut) y advertencia de pacientes similares por nombre. MSW simula respuestas de cada query.",
      },
    },
    msw: { handlers: baseHandlers },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={makeQueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CreatePatientModal>;

// Default: empty form ready for input. Submit will resolve to a fake
// patient row (see baseHandlers).
export const Default: Story = {
  name: "Default — formulario vacío",
  render: () => <ModalHarness />,
  // addon-vitest interaction: opens the modal and asserts the dialog
  // is reachable to AT. Closes the open-state coverage gap noted in
  // dialog-discovery.spec.ts. `storybook/test` is lazy-imported per
  // the AppModal.stories.tsx convention (Chromatic story-extractor
  // crashes on top-level imports of `storybook/test`).
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const root = within(canvasElement.ownerDocument.body);
    const dialog = await root.findByRole("dialog");
    await expect(dialog).toBeVisible();
  },
};

// Person already exists in the system as a non-patient (employee /
// usuario). The form shows the "rellenar datos" CTA so the operator can
// link the new patient profile to the existing Person.
export const PersonExistsNotPatient: Story = {
  name: "Validación — persona existe (no paciente)",
  render: () => <ModalHarness />,
  parameters: {
    msw: {
      handlers: [
        ...baseHandlers,
        http.post("*/api/orpc/people/rpc/findByRut", () =>
          ok({
            person: {
              id: 88,
              rut: "16.987.654-3",
              names: "Camila Andrea",
              fatherName: "Soto",
              motherName: "Vera",
              email: "camila.soto@bioalergia.cl",
              phone: "+56 9 1111 2222",
              personType: "NATURAL",
              createdAt: new Date("2024-01-01T00:00:00Z"),
              updatedAt: new Date("2025-12-01T00:00:00Z"),
              hasEmployee: true,
              hasUser: false,
              patient: null,
            },
          })
        ),
      ],
    },
  },
};

// Person already exists AND already has a patient profile. Submit is
// blocked; we show a loud red "Paciente ya registrado" banner.
export const AlreadyPatient: Story = {
  name: "Validación — ya es paciente",
  render: () => <ModalHarness />,
  parameters: {
    msw: {
      handlers: [
        ...baseHandlers,
        http.post("*/api/orpc/people/rpc/findByRut", () =>
          ok({
            person: {
              id: 88,
              rut: "16.987.654-3",
              names: "Camila Andrea",
              fatherName: "Soto",
              motherName: "Vera",
              email: "camila.soto@example.cl",
              phone: "+56 9 8765 4321",
              personType: "NATURAL",
              createdAt: new Date("2023-05-12T00:00:00Z"),
              updatedAt: new Date("2025-12-01T00:00:00Z"),
              hasEmployee: false,
              hasUser: false,
              patient: { id: 999 },
            },
          })
        ),
      ],
    },
  },
};

// Name search returns 2 fuzzy matches → soft "pacientes similares"
// warning, no submit block.
export const SimilarPatientsWarning: Story = {
  name: "Validación — pacientes con nombres similares",
  render: () => <ModalHarness />,
  parameters: {
    msw: {
      handlers: [
        ...baseHandlers,
        http.post("*/api/orpc/patients/rpc/list", () =>
          ok({
            patients: [
              {
                id: 401,
                personId: 401,
                birthDate: null,
                bloodType: null,
                notes: null,
                createdAt: new Date("2024-03-12T00:00:00Z"),
                updatedAt: new Date("2024-03-12T00:00:00Z"),
                person: {
                  id: 401,
                  rut: "12.345.678-5",
                  names: "Camila Beatriz",
                  fatherName: "Soto",
                  motherName: "Pérez",
                  email: null,
                  phone: "+56 9 5555 1234",
                  personType: "NATURAL",
                  createdAt: new Date("2024-03-12T00:00:00Z"),
                  updatedAt: new Date("2024-03-12T00:00:00Z"),
                },
              },
              {
                id: 402,
                personId: 402,
                birthDate: null,
                bloodType: null,
                notes: null,
                createdAt: new Date("2025-01-08T00:00:00Z"),
                updatedAt: new Date("2025-01-08T00:00:00Z"),
                person: {
                  id: 402,
                  rut: "9.876.543-2",
                  names: "Camila Andrea",
                  fatherName: "Soto",
                  motherName: "González",
                  email: null,
                  phone: null,
                  personType: "NATURAL",
                  createdAt: new Date("2025-01-08T00:00:00Z"),
                  updatedAt: new Date("2025-01-08T00:00:00Z"),
                },
              },
            ],
            total: 2,
          })
        ),
      ],
    },
  },
};

// Submit succeeds end to end (toast fires, modal closes). Identical to
// Default but documents the happy path explicitly.
export const SubmitSuccess: Story = {
  name: "Submit — éxito",
  render: () => <ModalHarness />,
};
