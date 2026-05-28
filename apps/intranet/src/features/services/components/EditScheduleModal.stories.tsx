import { Button } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { useState } from "react";

import type { ServiceSchedule } from "../types";
import { EditScheduleModal } from "./EditScheduleModal";

// Open-state coverage for the "Editar cuota" dialog after its migration to the
// AppModal shell + NumberField. Two regressions the prior raw-Modal version
// could ship silently:
//   1. Calendar popover overflowed a fixed-width floating dialog on mobile.
//      Fixed by AppModal (Modal.Container scroll="inside" + mobileFullscreen).
//   2. "Monto esperado" used TextField type="number" w/ step="0.01" (decimals
//      on a CLP amount = latent bug); now NumberField w/ CLP formatOptions
//      (no decimals).

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

const SCHEDULE: ServiceSchedule = {
  createdAt: new Date("2026-05-01"),
  dueDate: new Date("2026-05-10"),
  effectiveAmount: 125_000,
  expectedAmount: 125_000,
  id: 42,
  lateFeeAmount: 0,
  note: null,
  overdueDays: 0,
  paidAmount: null,
  paidDate: null,
  periodEnd: new Date("2026-05-31"),
  periodStart: new Date("2026-05-01"),
  serviceId: 1,
  status: "PENDING",
  transactionId: null,
  updatedAt: new Date("2026-05-01"),
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

/** Trigger wrapper — EditScheduleModal is open-state-driven by the parent. */
function EditScheduleHarness() {
  const [open, setOpen] = useState(false);
  return (
    <QueryClientProvider client={makeQueryClient()}>
      <div className="p-8">
        <Button onPress={() => setOpen(true)}>Editar cuota</Button>
        <EditScheduleModal isOpen={open} onClose={() => setOpen(false)} schedule={SCHEDULE} />
      </div>
    </QueryClientProvider>
  );
}

const meta: Meta<typeof EditScheduleHarness> = {
  title: "Services/EditScheduleModal",
  component: EditScheduleHarness,
  parameters: {
    layout: "fullscreen",
    msw: {
      handlers: [
        http.post("*/api/orpc/services/rpc/editServiceSchedule", () =>
          ok({ ...SCHEDULE, expectedAmount: 130_000 })
        ),
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof EditScheduleHarness>;

export const AbreDialogoYCalendario: Story = {
  name: "Abre diálogo + calendario",
  // `storybook/test` is lazy-imported per the AppModal.stories.tsx convention
  // (Chromatic's story extractor crashes on a top-level import).
  play: async ({ canvasElement }) => {
    const { expect, userEvent, within, waitFor } = await import("storybook/test");
    const doc = canvasElement.ownerDocument;
    const root = within(doc.body);

    await userEvent.click(await root.findByRole("button", { name: "Editar cuota" }));
    const dialog = await root.findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());

    // Open the calendar popover and assert it is not clipped by the viewport.
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
  globals: { viewport: { value: "mobile", isRotated: false } },
  parameters: { viewport: { defaultViewport: "mobile" } },
  play: AbreDialogoYCalendario.play,
};
