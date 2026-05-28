import { I18nProvider } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ScheduleSendModal } from "./ConversationParts";

// Open-state coverage for the WhatsApp "Programar mensaje" dialog. Its datetime
// DatePicker calendar popover clipped on mobile under the raw Modal; migrating
// to the AppModal shell (Modal.Container scroll="inside" + mobileFullscreen)
// keeps it inside the viewport. ScheduleSendModal takes plain callbacks (no
// oRPC inside), so no MSW handlers are needed — it renders open directly.

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

const meta: Meta<typeof ScheduleSendModal> = {
  title: "WaCloud/ScheduleSendModal",
  component: ScheduleSendModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Diálogo de programación de mensaje WhatsApp sobre el shell AppModal. El selector de fecha y hora no se corta en móvil.",
      },
    },
  },
  decorators: [
    (Story) => (
      <I18nProvider locale="es-CL">
        <QueryClientProvider client={makeQueryClient()}>
          <Story />
        </QueryClientProvider>
      </I18nProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ScheduleSendModal>;

const baseArgs = {
  isOpen: true,
  conversationId: 1,
  phoneNumberId: 10,
  defaultBody: "Recordatorio de tu cita",
  scheduled: [],
  isPending: false,
  onClose: () => {},
  onSchedule: () => {},
  onCancel: () => {},
};

export const Abierto: Story = {
  name: "Abierto — diálogo + calendario en viewport",
  render: () => <ScheduleSendModal {...baseArgs} />,
  play: async ({ canvasElement }) => {
    const { expect, userEvent, within, waitFor } = await import("storybook/test");
    const doc = canvasElement.ownerDocument;
    const root = within(doc.body);

    const dialog = await root.findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());

    const trigger = dialog.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]');
    await expect(trigger).not.toBeNull();
    await userEvent.click(trigger as HTMLButtonElement);

    await waitFor(async () => {
      const grid = doc.body.querySelector<HTMLElement>('[role="application"] [role="grid"]');
      await expect(grid).not.toBeNull();
      const rect = (grid as HTMLElement).getBoundingClientRect();
      await expect(rect.left).toBeGreaterThanOrEqual(0);
      await expect(rect.right).toBeLessThanOrEqual(doc.documentElement.clientWidth);
    });
  },
};

export const MobileCalendar: Story = {
  name: "Mobile — calendario no se corta",
  globals: { viewport: { value: "mobile1", isRotated: false } },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  render: () => <ScheduleSendModal {...baseArgs} />,
  play: Abierto.play,
};
