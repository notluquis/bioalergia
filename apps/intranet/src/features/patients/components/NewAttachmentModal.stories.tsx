import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { Button } from "@heroui/react";

import { NewAttachmentModal } from "./NewAttachmentModal";

// Stories for the patient document upload modal. The component holds a
// File ref and POSTs to `patients.createAttachment`. MSW intercepts both
// the success and error paths so the upload button can be exercised end
// to end without touching real storage.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

const ATTACHMENT_RESPONSE = {
  attachment: {
    id: 901,
    patientId: 42,
    name: "Consentimiento informado.pdf",
    type: "CONSENT",
    url: "https://files.bioalergia.cl/attachments/901.pdf",
    size: 184_320,
    uploadedAt: new Date("2026-05-12T15:30:00Z"),
  },
};

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
      <NewAttachmentModal isOpen={open} onClose={() => setOpen(false)} patientId="42" />
    </div>
  );
}

const meta: Meta<typeof NewAttachmentModal> = {
  title: "Patients/NewAttachmentModal",
  component: NewAttachmentModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Modal de carga de documentos clínicos (consentimiento, examen, receta, otro). El paciente queda asociado por id; el archivo viaja como multipart al endpoint `patients.createAttachment`.",
      },
    },
    msw: {
      handlers: [
        http.post("*/api/orpc/patients/rpc/createAttachment", () => ok(ATTACHMENT_RESPONSE)),
      ],
    },
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
type Story = StoryObj<typeof NewAttachmentModal>;

// Default: modal abierto sin archivo seleccionado, botón Subir
// deshabilitado.
export const Empty: Story = {
  render: () => <ModalHarness />,
  // addon-vitest interaction — modal renders, dialog reachable to AT.
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const root = within(canvasElement.ownerDocument.body);
    const dialog = await root.findByRole("dialog");
    await expect(dialog).toBeVisible();
  },
};

// Backend rejects the upload (413 — archivo demasiado grande). UI mostrará
// el toast de error tras intentar subir.
export const UploadError: Story = {
  render: () => <ModalHarness />,
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/patients/rpc/createAttachment", () =>
          HttpResponse.json(
            {
              json: {
                code: "PAYLOAD_TOO_LARGE",
                message: "El archivo supera el tamaño máximo (10 MB).",
                status: 413,
              },
              meta: [],
            },
            { status: 413 }
          )
        ),
      ],
    },
  },
};

// Modal cerrado: validación de que `isOpen={false}` no monta el dialog.
export const Closed: Story = {
  render: () => {
    return (
      <div className="p-8">
        <p className="text-sm text-default-600">
          Estado cerrado: el modal no se renderiza visualmente.
        </p>
        <NewAttachmentModal isOpen={false} onClose={() => {}} patientId="42" />
      </div>
    );
  },
};
