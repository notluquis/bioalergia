import { I18nProvider } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import type { PersonalCreditInstallment } from "../types";
import { PayInstallmentModal } from "./PayInstallmentModal";

// Open-state coverage for the "Pagar Cuota" dialog. Regression guard for two
// bugs the prior raw-Modal implementation shipped silently (no story/test
// caught them):
//   1. The calendar popover overflowed a fixed-width floating dialog on
//      mobile (cut off at the right edge). Fixed by migrating to the AppModal
//      shell (Modal.Container scroll="inside" + mobileFullscreen).
//   2. Amount used TextField type="number" (raw "9.68"); now NumberField with
//      currency-aware formatOptions (UF → 2 decimals, CLP → 0).
//   3. Dates rendered en-US ("5/27/2026"); now es-CL via the app I18nProvider,
//      mirrored here in the decorator.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

const INSTALLMENT: PersonalCreditInstallment = {
  amount: 9.68,
  creditId: 1,
  dueDate: "2026-05-10",
  id: 10,
  installmentNumber: 5,
  status: "PENDING",
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

const meta: Meta<typeof PayInstallmentModal> = {
  title: "PersonalFinance/PayInstallmentModal",
  component: PayInstallmentModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Diálogo de pago de cuota sobre el shell AppModal. Monto vía NumberField (formato según moneda del crédito: UF decimal, CLP sin decimales), fecha vía DatePicker localizado es-CL.",
      },
    },
    msw: {
      handlers: [
        http.post("*/api/orpc/personal-finance/rpc/payInstallment", () =>
          ok({ ...INSTALLMENT, status: "PAID", paidAmount: 9.68, paidAt: "2026-05-27" })
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
type Story = StoryObj<typeof PayInstallmentModal>;

/** UF credit → amount keeps 2 decimals (the "9.68" case from the bug report). */
export const CreditoUF: Story = {
  name: "Crédito UF — abre diálogo + calendario",
  render: () => <PayInstallmentModal creditId={1} currency="UF" installment={INSTALLMENT} />,
  // addon-vitest interaction: opens the dialog AND the calendar popover, the
  // exact path that was clipped/unformatted and untested before. `storybook/test`
  // is lazy-imported per the AppModal.stories.tsx convention (Chromatic's
  // story extractor crashes on a top-level import).
  play: async ({ canvasElement }) => {
    const { expect, userEvent, within, waitFor } = await import("storybook/test");
    const doc = canvasElement.ownerDocument;
    const root = within(doc.body);

    // Open the modal.
    await userEvent.click(await root.findByRole("button", { name: "Pagar" }));
    const dialog = await root.findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());

    // Amount NumberField shows the UF value with 2 decimals (es-CL → comma).
    const amount = within(dialog).getByLabelText("Monto Pagado");
    await expect(amount).toHaveValue("9,68");

    // Open the calendar popover and assert it is not clipped.
    const trigger = dialog.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]');
    await expect(trigger).not.toBeNull();
    await userEvent.click(trigger as HTMLButtonElement);

    await waitFor(async () => {
      const grid = doc.body.querySelector<HTMLElement>('[role="application"] [role="grid"]');
      await expect(grid).not.toBeNull();
      const rect = (grid as HTMLElement).getBoundingClientRect();
      // Calendar must fit within the viewport (the mobile clipping regression).
      await expect(rect.left).toBeGreaterThanOrEqual(0);
      await expect(rect.right).toBeLessThanOrEqual(doc.documentElement.clientWidth);
    });
  },
};

/** CLP credit → amount shows currency symbol, no decimals. */
export const CreditoCLP: Story = {
  name: "Crédito CLP — sin decimales",
  render: () => (
    <PayInstallmentModal
      creditId={1}
      currency="CLP"
      installment={{ ...INSTALLMENT, amount: 125_000 }}
    />
  ),
  play: async ({ canvasElement }) => {
    const { expect, userEvent, within, waitFor } = await import("storybook/test");
    const root = within(canvasElement.ownerDocument.body);
    await userEvent.click(await root.findByRole("button", { name: "Pagar" }));
    const dialog = await root.findByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());
  },
};

/** Mobile viewport — guards the calendar-overflow regression on narrow screens. */
export const MobileCalendar: Story = {
  name: "Mobile — calendario no se corta",
  globals: { viewport: { value: "mobile1", isRotated: false } },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  render: () => <PayInstallmentModal creditId={1} currency="UF" installment={INSTALLMENT} />,
  play: CreditoUF.play,
};
