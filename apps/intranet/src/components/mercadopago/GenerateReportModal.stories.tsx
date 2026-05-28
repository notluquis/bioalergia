import { I18nProvider } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import { ToastProvider } from "@/context/ToastContext";
import { GenerateReportModal } from "./GenerateReportModal";

// Open-state coverage for the MercadoPago "Generar Reporte" dialog. Regression
// guard for the calendar-popover clipping the raw-Modal implementation shipped
// silently: the modal now uses the AppModal shell (Modal.Container
// scroll="inside" + mobileFullscreen) so the begin/end DatePicker calendars
// stay inside the viewport on mobile.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

const meta: Meta<typeof GenerateReportModal> = {
  title: "MercadoPago/GenerateReportModal",
  component: GenerateReportModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Diálogo de generación de reportes MercadoPago sobre el shell AppModal. Dos DatePicker (inicio/fin) localizados es-CL; el calendario no se corta en móvil.",
      },
    },
    msw: {
      handlers: [
        http.post("*/api/orpc/mercadopago/rpc/createReport", () =>
          ok({
            id: "rep_1",
            begin_date: "2026-05-20",
            end_date: "2026-05-27",
            status: "pending",
          })
        ),
      ],
    },
  },
  decorators: [
    (Story) => (
      <I18nProvider locale="es-CL">
        <QueryClientProvider client={makeQueryClient()}>
          <ToastProvider>
            <div className="p-8">
              <Story />
            </div>
          </ToastProvider>
        </QueryClientProvider>
      </I18nProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof GenerateReportModal>;

/** Modal opens directly via the `open` prop; assert dialog + calendar in viewport. */
export const Abierto: Story = {
  name: "Abierto — diálogo + calendario en viewport",
  render: () => <GenerateReportModal open onClose={() => {}} reportType="release" />,
  play: async ({ canvasElement }) => {
    const { expect, userEvent, within, waitFor } = await import("storybook/test");
    const doc = canvasElement.ownerDocument;
    const root = within(doc.body);

    const dialog = await root.findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());

    // Open the first calendar popover (begin date) and assert it is not clipped.
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

/** Mobile viewport — guards the calendar-overflow regression on narrow screens. */
export const MobileCalendar: Story = {
  name: "Mobile — calendario no se corta",
  globals: { viewport: { value: "mobile1", isRotated: false } },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  render: () => <GenerateReportModal open onClose={() => {}} reportType="release" />,
  play: Abierto.play,
};
