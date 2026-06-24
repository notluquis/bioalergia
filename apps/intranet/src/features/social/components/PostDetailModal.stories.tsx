import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Button } from "@heroui/react";
import { useState } from "react";

import { PostDetailModal } from "./PostDetailModal";

// Open-state coverage (CLAUDE.md rule): the detail modal MUST have a story
// whose play() actually OPENS it and asserts the inner content is reachable.
// The post is fetched via `social.detail` → resolved by the default MSW
// handler (returns the DRAFT fixture: caption, rendered media, two targets).

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-8">
      <Button onPress={() => setOpen(true)}>Ver detalle</Button>
      <PostDetailModal isOpen={open} onClose={() => setOpen(false)} postId={101} />
    </div>
  );
}

const meta: Meta<typeof PostDetailModal> = {
  title: "Social/PostDetailModal",
  component: PostDetailModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Modal de detalle de publicación: vista previa de media, texto/caption, hashtags, estado por destino y acciones (aprobar/rechazar/programar/publicar). El post se obtiene vía social.detail (MSW).",
      },
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
type Story = StoryObj<typeof PostDetailModal>;

export const OpensWithContent: Story = {
  name: "Abre y muestra el contenido",
  render: () => <ModalHarness />,
  // `storybook/test` is lazy-imported inside play() per the AppModal.stories
  // convention (Chromatic's headless extractor crashes on top-level imports).
  play: async ({ canvasElement }) => {
    const { expect, userEvent, waitFor, within } = await import("storybook/test");
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    // Open the modal.
    await userEvent.click(await canvas.findByRole("button", { name: "Ver detalle" }));

    const root = within(doc.body);
    const dialog = await root.findByRole("dialog");
    // Espera el final de la animación de entrada del Modal (opacity 0→1).
    await waitFor(() => expect(dialog).toBeVisible());

    // Caption text from the DRAFT fixture.
    await expect(await root.findByText(/Estornudos sin parar/)).toBeVisible();

    // Rendered media preview (img alt falls back to the title).
    const media = within(dialog).getByRole("img", { name: /Promo invierno|Vista previa/ });
    await expect(media).toBeInTheDocument();

    // Per-target status: target row renders "Instagram · IG Feed" (single node).
    await expect(await within(dialog).findByText(/IG Feed/)).toBeVisible();
    await expect((await within(dialog).findAllByText("Pendiente")).length).toBeGreaterThan(0);
  },
};
