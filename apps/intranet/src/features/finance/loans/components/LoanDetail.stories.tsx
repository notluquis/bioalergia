import { I18nProvider } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import type { LoanSchedule, LoanSummary } from "../types";
import { LoanDetail } from "./LoanDetail";

// Open-state coverage for the "Regenerar cronograma" dialog. Regression guard
// for the raw-Modal implementation it replaced:
//   1. DatePicker calendar popover clipped on mobile inside a fixed-width
//      floating dialog. Fixed by migrating to the AppModal shell.
//   2. "Total de cuotas" / "Tasa de interés" used raw type="number" Input; now
//      NumberField (count + decimal rate).

const LOAN: LoanSummary = {
  borrower_name: "Juan Pérez",
  borrower_type: "PERSON",
  created_at: new Date("2026-01-01"),
  frequency: "MONTHLY",
  id: 1,
  interest_rate: 2.5,
  interest_type: "SIMPLE",
  notes: null,
  paid_installments: 1,
  pending_installments: 11,
  principal_amount: 1_200_000,
  public_id: "loan_1",
  remaining_amount: 1_100_000,
  start_date: "2026-01-15",
  status: "ACTIVE",
  title: "Préstamo Vehículo",
  total_expected: 1_230_000,
  total_installments: 12,
  total_paid: 130_000,
  updated_at: new Date("2026-01-01"),
};

const SCHEDULES: LoanSchedule[] = [
  {
    created_at: new Date("2026-01-01"),
    due_date: "2026-02-15",
    expected_amount: 102_500,
    expected_interest: 2_500,
    expected_principal: 100_000,
    id: 1,
    installment_number: 1,
    loan_id: 1,
    paid_amount: 102_500,
    paid_date: "2026-02-14",
    status: "PAID",
    transaction_id: 555,
    updated_at: new Date("2026-02-14"),
  },
];

const SUMMARY = {
  paid_installments: 1,
  pending_installments: 11,
  remaining_amount: 1_100_000,
  total_expected: 1_230_000,
  total_paid: 130_000,
};

const meta: Meta<typeof LoanDetail> = {
  title: "Finance/Loans/LoanDetail",
  component: LoanDetail,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Detalle de préstamo con el diálogo 'Regenerar cronograma' sobre el shell AppModal (DatePicker localizado es-CL, total de cuotas + tasa vía NumberField).",
      },
    },
  },
  decorators: [
    (Story) => (
      <I18nProvider locale="es-CL">
        <div className="h-screen p-8">
          <Story />
        </div>
      </I18nProvider>
    ),
  ],
  args: {
    canManage: true,
    loading: false,
    loan: LOAN,
    schedules: SCHEDULES,
    summary: SUMMARY,
    onRegenerate: async () => {},
    onRegisterPayment: () => {},
    onUnlinkPayment: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof LoanDetail>;

/** Opens the regenerate dialog and the calendar popover, asserting it fits the viewport. */
export const RegenerarCronograma: Story = {
  name: "Regenerar cronograma — abre diálogo + calendario",
  play: async ({ canvasElement }) => {
    const { expect, userEvent, within, waitFor } = await import("storybook/test");
    const doc = canvasElement.ownerDocument;
    const root = within(doc.body);

    await userEvent.click(await root.findByRole("button", { name: "Regenerar cronograma" }));
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

/** Mobile viewport — guards the calendar-overflow regression on narrow screens. */
export const MobileCalendar: Story = {
  name: "Mobile — calendario no se corta",
  globals: { viewport: { value: "mobile1", isRotated: false } },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  play: RegenerarCronograma.play,
};
