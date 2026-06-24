import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Button } from "@heroui/react";
import { useState } from "react";

import { CreatePostModal } from "./CreatePostModal";

// Open-state coverage (CLAUDE.md rule): the create modal MUST have a story
// whose play() opens it and asserts the form renders. Connected accounts come
// from `social.listAccounts` (MSW default → one Meta account with IG + FB),
// so the target picker is populated.

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-8">
      <Button onPress={() => setOpen(true)}>Nuevo borrador</Button>
      <CreatePostModal isOpen={open} onClose={() => setOpen(false)} />
    </div>
  );
}

const meta: Meta<typeof CreatePostModal> = {
  title: "Social/CreatePostModal",
  component: CreatePostModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Modal de creación de borrador: título interno, caption, hashtags, tipo de media, proporción y selección de destinos (red + placement por cuenta conectada). Cuentas y create vía MSW.",
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
type Story = StoryObj<typeof CreatePostModal>;

export const OpensWithForm: Story = {
  name: "Abre y muestra el formulario",
  render: () => <ModalHarness />,
  play: async ({ canvasElement }) => {
    const { expect, userEvent, waitFor, within } = await import("storybook/test");
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);

    // Open the modal.
    await userEvent.click(await canvas.findByRole("button", { name: "Nuevo borrador" }));

    const root = within(doc.body);
    const dialog = await root.findByRole("dialog");
    // Espera el final de la animación de entrada del Modal (opacity 0→1).
    await waitFor(() => expect(dialog).toBeVisible());

    // Form fields render.
    await expect(await within(dialog).findByText(/Título \(interno\)/)).toBeVisible();
    await expect(within(dialog).getByText(/Texto \/ caption/)).toBeVisible();
    await expect(within(dialog).getByText("Destinos")).toBeVisible();

    // Target picker populated from the connected Meta account (one row per
    // network+placement, all prefixed with the account name).
    await expect(
      await within(dialog).findByText(/Bioalergia \(Meta\) · Instagram IG Feed/)
    ).toBeVisible();

    // Submit button present.
    await expect(within(dialog).getByRole("button", { name: /Crear borrador/ })).toBeVisible();
  },
};
