import { I18nProvider } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import { WaCloudBroadcastsPage } from "./WaCloudBroadcastsPage";

// Open-state coverage for the "Nueva campaña" broadcast dialog. The schedule
// control (AppDateTimePicker) calendar popover clipped on mobile under the raw
// Modal; migrating to the AppModal shell (Modal.Container scroll="inside" +
// mobileFullscreen) keeps it inside the viewport. This page is coupled to
// several oRPC queries, so we stub the minimum (empty broadcasts + one account
// + one approved template) to render the page and open the modal.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

const ACCOUNT = {
  id: 1,
  wabaId: "waba_1",
  displayName: "Clínica",
  phoneNumbers: [{ id: 10, label: "Recepción", displayPhoneNumber: "+56912345678" }],
};

const TEMPLATE = { name: "recordatorio", language: "es", status: "APPROVED" };

const meta: Meta<typeof WaCloudBroadcastsPage> = {
  title: "WaCloud/BroadcastsPage",
  component: WaCloudBroadcastsPage,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Página de campañas WhatsApp. El diálogo 'Nueva campaña' usa el shell AppModal; el calendario de programación (AppDateTimePicker) no se corta en móvil.",
      },
    },
    msw: {
      handlers: [
        http.post("*/api/orpc/wa-cloud/rpc/listBroadcasts", () => ok({ broadcasts: [] })),
        http.post("*/api/orpc/wa-cloud/rpc/listAccounts", () => ok({ accounts: [ACCOUNT] })),
        http.post("*/api/orpc/wa-cloud/rpc/listTemplates", () => ok({ templates: [TEMPLATE] })),
      ],
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
type Story = StoryObj<typeof WaCloudBroadcastsPage>;

export const NuevaCampana: Story = {
  name: "Nueva campaña — diálogo + calendario en viewport",
  play: async ({ canvasElement }) => {
    const { expect, userEvent, within, waitFor } = await import("storybook/test");
    const doc = canvasElement.ownerDocument;
    const root = within(doc.body);

    await userEvent.click(await root.findByRole("button", { name: /Nueva campaña/ }));
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
  play: NuevaCampana.play,
};
