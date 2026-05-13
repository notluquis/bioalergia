import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse } from "msw";

import { ChatBubble, type ChatBubbleRow } from "./ChatBubble";

// ChatBubble fixtures cover the main render paths exercised in the
// inbox: text in/out, failed delivery, quoted reply, reactions,
// template carousel preview, special payloads (location/contacts),
// and a sticker.
//
// Media-attachment branches (IMAGE/VIDEO/AUDIO/DOCUMENT/STICKER) call
// `/api/wa-cloud/media/{id}` directly via <img>/<video>; we stub those
// to a 1×1 transparent PNG so the lazy IntersectionObserver path doesn't
// log noisy 404s during the test run.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });
const TRANSPARENT_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
  ),
  (c) => c.charCodeAt(0)
);

const meta: Meta<typeof ChatBubble> = {
  title: "WaCloud/ChatBubble",
  component: ChatBubble,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Burbuja única de mensaje WhatsApp. Dirección (out/in), estado (PENDING/SENT/DELIVERED/READ/FAILED), tipo (TEXT/STICKER/LOCATION/CONTACTS/INTERACTIVE/TEMPLATE carousel/UNSUPPORTED) y reacciones rápidas.",
      },
    },
    msw: {
      handlers: [
        http.get("*/api/wa-cloud/media/*", () =>
          HttpResponse.arrayBuffer(TRANSPARENT_PNG.buffer, {
            headers: { "Content-Type": "image/png" },
          })
        ),
        http.post("*/api/orpc/*", () => ok({})),
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ChatBubble>;

const noopHandlers = {
  onReply: () => {},
  onReact: () => {},
  onEdit: () => {},
};

function Row({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md space-y-3 bg-content2/40 p-4">{children}</div>;
}

const FIVE_MINUTES_AGO = new Date(Date.now() - 5 * 60 * 1000);

export const InboundText: Story = {
  name: "Texto entrante",
  render: () => {
    const row: ChatBubbleRow = {
      messageId: 101,
      metaMessageId: "wamid.HBgL1",
      out: false,
      body: "Hola doctora, ¿confirma mi hora del jueves a las 16:00?",
      type: "TEXT",
      timestamp: FIVE_MINUTES_AGO,
      status: "DELIVERED",
    };
    return (
      <Row>
        <ChatBubble row={row} {...noopHandlers} />
      </Row>
    );
  },
};

export const OutboundReadWithReactions: Story = {
  name: "Texto saliente — leído + reacciones",
  render: () => {
    const row: ChatBubbleRow = {
      messageId: 102,
      metaMessageId: "wamid.HBgL2",
      out: true,
      body: "Confirmada la hora. Te recuerdo traer los exámenes previos. ¡Nos vemos!",
      type: "TEXT",
      timestamp: FIVE_MINUTES_AGO,
      status: "READ",
      reactions: [
        { emoji: "👍", out: false },
        { emoji: "❤️", out: false },
      ],
    };
    return (
      <Row>
        <ChatBubble row={row} {...noopHandlers} />
      </Row>
    );
  },
};

export const OutboundFailed: Story = {
  name: "Saliente — falló (24h ventana)",
  render: () => {
    const row: ChatBubbleRow = {
      messageId: 103,
      metaMessageId: "wamid.HBgL3",
      out: true,
      body: "Recordatorio: tu próxima sesión de inmunoterapia es mañana.",
      type: "TEXT",
      timestamp: FIVE_MINUTES_AGO,
      status: "FAILED",
      errorTitle: "Fuera de la ventana de servicio (131047)",
      errorDetails: "Se requiere plantilla aprobada para reabrir conversación",
    };
    return (
      <Row>
        <ChatBubble row={row} {...noopHandlers} />
      </Row>
    );
  },
};

export const OutboundQuotedReply: Story = {
  name: "Saliente — responde a un mensaje previo",
  render: () => {
    const row: ChatBubbleRow = {
      messageId: 104,
      metaMessageId: "wamid.HBgL4",
      out: true,
      body: "Sí, dejé tu receta lista en recepción.",
      type: "TEXT",
      timestamp: FIVE_MINUTES_AGO,
      status: "DELIVERED",
      quotedSnippet: {
        body: "¿Podrías dejarme la receta para retirar mañana?",
        out: false,
      },
    };
    return (
      <Row>
        <ChatBubble row={row} {...noopHandlers} />
      </Row>
    );
  },
};

export const OutboundCarouselTemplate: Story = {
  name: "Saliente — plantilla carousel",
  render: () => {
    const row: ChatBubbleRow = {
      messageId: 106,
      metaMessageId: "wamid.HBgL6",
      out: true,
      body: null,
      type: "TEMPLATE",
      templateName: "promo_inmunoterapia_otono",
      timestamp: FIVE_MINUTES_AGO,
      status: "SENT",
      payload: {
        components: [
          {
            type: "carousel",
            cards: [
              {
                card_index: 0,
                components: [
                  {
                    type: "header",
                    parameters: [{ type: "image", image: { id: "fake-meta-img-1" } }],
                  },
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: "Plan rinitis: 30% off agendando antes del 30/05." },
                    ],
                  },
                ],
              },
              {
                card_index: 1,
                components: [
                  {
                    type: "header",
                    parameters: [{ type: "image", image: { id: "fake-meta-img-2" } }],
                  },
                  {
                    type: "body",
                    parameters: [
                      { type: "text", text: "Asma alérgica: evaluación + plan a 12 meses." },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    return (
      <Row>
        <ChatBubble row={row} {...noopHandlers} />
      </Row>
    );
  },
};
