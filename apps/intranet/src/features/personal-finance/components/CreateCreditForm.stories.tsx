import { I18nProvider } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import { CreateCreditForm } from "./CreateCreditForm";

// Open-state coverage for the "Nuevo Crédito" dialog. Regression guard for the
// raw-Modal era:
//   1. The start-date calendar popover could overflow the floating dialog and
//      get clipped. Fixed by migrating to the AppModal shell (Modal.Container
//      scroll="inside" + mobileFullscreen).
//   2. Monto Total uses NumberField with currency-aware formatOptions driven by
//      the currency Select (UF → 2 decimals, CLP → 0, USD → 2).

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

const meta: Meta<typeof CreateCreditForm> = {
  title: "PersonalFinance/CreateCreditForm",
  component: CreateCreditForm,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Diálogo de creación de crédito sobre el shell AppModal. Monto Total vía NumberField (formato según moneda: UF decimal, CLP sin decimales), fecha de inicio vía DatePicker localizado es-CL.",
      },
    },
    msw: {
      handlers: [
        http.post("*/api/orpc/personal-finance/rpc/createCredit", () =>
          ok({ id: 1, bankName: "BCI", currency: "CLP", totalAmount: 1_000_000 })
        ),
      ],
    },
  },
  decorators: [
    (Story) => (
      <I18nProvider locale="es-CL">
        <QueryClientProvider client={makeQueryClient()}>
          <div className="p-8">
            <Story />
          </div>
        </QueryClientProvider>
      </I18nProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CreateCreditForm>;

/** Opens the dialog AND the start-date calendar, guarding the clip regression. */
export const Default: Story = {
  name: "Abre diálogo + calendario",
  render: () => <CreateCreditForm />,
  // `storybook/test` is lazy-imported per the AppModal.stories.tsx convention
  // (Chromatic's story extractor crashes on a top-level import).
  play: async ({ canvasElement }) => {
    const { expect, userEvent, within, waitFor } = await import("storybook/test");
    const doc = canvasElement.ownerDocument;
    const root = within(doc.body);

    // Open the modal.
    await userEvent.click(await root.findByRole("button", { name: "Nuevo Crédito" }));
    const dialog = await root.findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());

    // Open the calendar popover and assert it is not clipped.
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
  render: () => <CreateCreditForm />,
  play: Default.play,
};
