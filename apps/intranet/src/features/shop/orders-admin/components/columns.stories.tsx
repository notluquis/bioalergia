import type { Meta, StoryObj } from "@storybook/react-vite";

import { DataTable } from "@/components/data-table/DataTable";
import type { OrderSummary } from "../types";
import { columns } from "./columns";
import type { OrdersTableMeta } from "./columns";

// Row-action coverage for the orders admin table. The per-status action set lives
// in `columns.tsx` (gated on `meta.canUpdate` + the row status), so the story
// renders the real `columns` through the shared DataTable with a static two-row
// fixture — no queries, no auth context needed (canUpdate is passed via meta).
//
//   PAID    → Ver · Marcar despachado · Reembolsar
//   PENDING → Ver · Cancelar
//
// ("Editar dirección" lives inside OrderDetailModal, which needs auth + toast +
// query context; the row-action set is the light, self-contained surface.)

function order(
  overrides: Partial<OrderSummary> & Pick<OrderSummary, "id" | "number" | "status">
): OrderSummary {
  return {
    customer_name: "Cliente Demo",
    customer_email: "cliente@correo.cl",
    billing_type: "BOLETA",
    total_clp: 23980,
    dte_folio: "10042",
    dte_type: "39",
    item_count: 2,
    created_at: new Date("2026-06-01T12:00:00.000Z"),
    ...overrides,
  };
}

const ROWS: OrderSummary[] = [
  order({ id: 1, number: "BA-2026-0001", status: "PAID" }),
  order({ id: 2, number: "BA-2026-0002", status: "PENDING", dte_folio: null, dte_type: null }),
];

function makeMeta(canUpdate: boolean): OrdersTableMeta {
  return {
    canUpdate,
    onView: () => undefined,
    onFulfill: () => undefined,
    fulfillingId: null,
    onCancel: () => undefined,
    cancellingId: null,
    onRefund: () => undefined,
    refundingId: null,
  };
}

function Table({ canUpdate }: { canUpdate: boolean }) {
  return (
    <div className="p-6">
      <DataTable
        columns={columns}
        containerVariant="plain"
        data={ROWS}
        enableExport={false}
        enableGlobalFilter={false}
        enablePagination={false}
        meta={makeMeta(canUpdate)}
        noDataMessage="No hay pedidos registrados."
      />
    </div>
  );
}

const meta: Meta<typeof Table> = {
  title: "Shop/OrdersAdmin/RowActions",
  component: Table,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof Table>;

// Operator WITH update rights: PAID exposes despachar + reembolsar, PENDING
// exposes cancelar. Every row can always be viewed.
export const WithUpdateRights: Story = {
  render: () => <Table canUpdate />,
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const canvas = within(canvasElement);

    // PAID row → dispatch + refund.
    await expect(
      await canvas.findByRole("button", { name: /Marcar despachado/ })
    ).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /Reembolsar/ })).toBeInTheDocument();

    // PENDING row → cancel.
    await expect(canvas.getByRole("button", { name: /Cancelar/ })).toBeInTheDocument();

    // Both rows are viewable.
    await expect(canvas.getAllByRole("button", { name: /Ver/ }).length).toBeGreaterThanOrEqual(2);
  },
};

// Read-only operator (no ShopOrder update permission): only "Ver" remains; the
// mutating actions are hidden regardless of status.
export const ReadOnly: Story = {
  render: () => <Table canUpdate={false} />,
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const canvas = within(canvasElement);

    // Every row still viewable (one "Ver" per row).
    await expect((await canvas.findAllByRole("button", { name: /Ver/ })).length).toBe(2);
    await expect(canvas.queryByRole("button", { name: /Marcar despachado/ })).toBeNull();
    await expect(canvas.queryByRole("button", { name: /Reembolsar/ })).toBeNull();
    await expect(canvas.queryByRole("button", { name: /Cancelar/ })).toBeNull();
  },
};
