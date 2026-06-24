import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  ContactsBubble,
  InteractiveBubble,
  LocationBubble,
  UnsupportedBubble,
} from "./SpecialMessage";

// Sub-bubble renderers used inside ChatBubble for non-text WhatsApp
// payloads. Pure render — no hooks, no network. We feed each one a
// realistic Meta payload fixture.

const meta: Meta = {
  title: "WaCloud/SpecialMessage",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Bubbles especializados para payloads que no son texto plano: ubicación compartida, contactos, respuestas de Flow interactivos y mensajes no soportados (encuesta, evento, otros).",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-default-200 bg-content1 p-3 shadow-sm">
      {children}
    </div>
  );
}

export const LocationConsultorio: Story = {
  name: "Location — Consultorio Las Condes",
  render: () => (
    <Frame>
      <LocationBubble
        payload={{
          location: {
            latitude: -33.41742,
            longitude: -70.60412,
            name: "Bioalergia — Consulta Las Condes",
            address: "Av. Apoquindo 5400, Of. 802, Las Condes, Santiago",
          },
        }}
      />
    </Frame>
  ),
};

export const Contacts: Story = {
  name: "Contacts — paciente comparte derivación",
  render: () => (
    <Frame>
      <ContactsBubble
        payload={{
          contacts: [
            {
              name: { formatted_name: "Dr. Felipe Soto Vera", first_name: "Felipe" },
              phones: [
                { phone: "+56 2 2345 6789", type: "WORK" },
                { phone: "+56 9 8765 4321", type: "CELL", wa_id: "56987654321" },
              ],
              emails: [{ email: "felipe.soto@clinicaalergia.cl", type: "WORK" }],
            },
          ],
        }}
      />
    </Frame>
  ),
};

export const InteractiveFlowReply: Story = {
  name: "Interactive — respuesta de formulario (nfm_reply)",
  render: () => (
    <Frame>
      <InteractiveBubble
        body={null}
        payload={{
          interactive: {
            type: "nfm_reply",
            nfm_reply: {
              name: "Triaje alergia",
              response_json: JSON.stringify({
                motivo: "Rinitis persistente",
                duracion_meses: "6",
                medicamentos: "Loratadina 10mg",
              }),
            },
          },
        }}
      />
    </Frame>
  ),
};

export const UnsupportedPoll: Story = {
  name: "Unsupported — encuesta",
  render: () => (
    <Frame>
      <UnsupportedBubble
        payload={{
          type: "unsupported",
          errors: [{ code: 131051, title: "Poll messages are not supported" }],
        }}
      />
    </Frame>
  ),
};
