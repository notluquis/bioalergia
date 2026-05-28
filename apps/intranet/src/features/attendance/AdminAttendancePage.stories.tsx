import { I18nProvider } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import { AdminAttendancePage } from "./AdminAttendancePage";

// Open-state coverage for the "Corrección manual" (AdminMarkModal) dialog. Its
// AppDateTimePicker calendar popover clipped on mobile under the raw Modal;
// migrating to the AppModal shell (Modal.Container scroll="inside" +
// mobileFullscreen) keeps it inside the viewport. The page is Suspense-driven,
// so the list + office-networks queries are stubbed to resolve immediately.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

const meta: Meta<typeof AdminAttendancePage> = {
  title: "Attendance/AdminAttendancePage",
  component: AdminAttendancePage,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Página de administración de asistencia. El diálogo 'Corrección manual' usa el shell AppModal; el AppDateTimePicker no se corta en móvil.",
      },
    },
    msw: {
      handlers: [
        http.post("*/api/orpc/attendance/rpc/listMarks", () =>
          ok({ marks: [], summary: { totalMarks: 0, incompleteDays: 0, totalWorkedMinutes: 0 } })
        ),
        http.post("*/api/orpc/attendance/rpc/listOfficeNetworks", () => ok({ networks: [] })),
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
type Story = StoryObj<typeof AdminAttendancePage>;

export const CorreccionManual: Story = {
  name: "Corrección manual — diálogo + calendario en viewport",
  play: async ({ canvasElement }) => {
    const { expect, userEvent, within, waitFor } = await import("storybook/test");
    const doc = canvasElement.ownerDocument;
    const root = within(doc.body);

    await userEvent.click(await root.findByRole("button", { name: "Corrección manual" }));
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
  play: CorreccionManual.play,
};
