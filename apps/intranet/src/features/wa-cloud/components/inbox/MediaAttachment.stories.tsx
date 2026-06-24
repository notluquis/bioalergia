import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse } from "msw";

import { MediaAttachment } from "./MediaAttachment";

// MediaAttachment lazy-loads via IntersectionObserver and then fetches
// `/api/wa-cloud/media/{messageId}` for the actual bytes. We stub the
// media endpoint with a 1×1 transparent PNG so the lazy branch resolves
// without log spam, and exercise each rendered variant.

const TRANSPARENT_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
  ),
  (c) => c.charCodeAt(0)
);

const meta: Meta<typeof MediaAttachment> = {
  title: "WaCloud/MediaAttachment",
  component: MediaAttachment,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Adjunto multimedia perezoso: detecta entrar al viewport, pide bytes al proxy `/api/wa-cloud/media/:id`, y renderiza imagen / video / audio (con velocidad 1x/1.5x/2x) / sticker / documento (con vista previa PDF en modal).",
      },
    },
    msw: {
      handlers: [
        http.get("*/api/wa-cloud/media/*", () =>
          HttpResponse.arrayBuffer(TRANSPARENT_PNG.buffer, {
            headers: { "Content-Type": "image/png" },
          })
        ),
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof MediaAttachment>;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-default-200 bg-content1 p-3">
      {children}
    </div>
  );
}

export const ImageInbound: Story = {
  name: "IMAGE entrante con caption",
  render: () => (
    <Frame>
      <MediaAttachment
        messageId={201}
        type="IMAGE"
        caption="Foto de la reacción cutánea esta mañana"
      />
    </Frame>
  ),
};

export const AudioOutbound: Story = {
  name: "AUDIO saliente — verde clínico",
  render: () => (
    <Frame>
      <MediaAttachment messageId={203} type="AUDIO" out />
    </Frame>
  ),
};

export const Video: Story = {
  name: "VIDEO con caption",
  render: () => (
    <Frame>
      <MediaAttachment
        messageId={205}
        type="VIDEO"
        caption="Demostración del autoinyector adrenalina"
      />
    </Frame>
  ),
};

export const DocumentPdf: Story = {
  name: "DOCUMENT — PDF receta",
  render: () => (
    <Frame>
      <MediaAttachment messageId={206} type="DOCUMENT" caption="receta_inmunoterapia_2026-05.pdf" />
    </Frame>
  ),
};

export const ImageError: Story = {
  name: "IMAGE — proxy devuelve 404",
  render: () => (
    <Frame>
      <MediaAttachment
        messageId={207}
        type="IMAGE"
        caption="Adjunto vencido (Meta media id expira a 30 días)"
      />
    </Frame>
  ),
  parameters: {
    msw: {
      handlers: [
        http.get("*/api/wa-cloud/media/*", () => HttpResponse.text("not found", { status: 404 })),
      ],
    },
  },
};
