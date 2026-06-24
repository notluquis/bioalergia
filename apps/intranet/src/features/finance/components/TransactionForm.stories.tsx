import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { Button } from "@heroui/react";

import type { CashFlowTransaction, TransactionCategoryOption } from "./CashFlowColumns";
import { TransactionForm } from "./TransactionForm";

// Stories for the cash-flow transaction modal. Form does Zod validation
// and POST/PATCH to `finance.transactionsCreate` / `transactionsUpdate`
// via oRPC. We intercept both endpoints per story so create + edit flows
// can be exercised without a backend.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

const CATEGORIES: TransactionCategoryOption[] = [
  { id: 1, name: "Arriendo consultorio", color: "#3B82F6" },
  { id: 2, name: "Sueldos y honorarios", color: "#10B981" },
  { id: 3, name: "Insumos clínicos", color: "#F59E0B" },
  { id: 4, name: "Inmunoterapia (proveedores)", color: "#8B5CF6" },
  { id: 5, name: "Servicios básicos", color: "#EF4444" },
  { id: 6, name: "Aporte socio (no contabilizable)", color: "#6B7280" },
];

const EDIT_TRANSACTION: CashFlowTransaction = {
  id: 7788,
  date: new Date("2026-04-21T00:00:00Z"),
  description: "Pago arriendo abril 2026 — Las Condes",
  amount: 850_000,
  type: "EXPENSE",
  categoryId: 1,
  category: CATEGORIES[0],
  comment: "Transferencia BancoEstado, pagado con 3 días de atraso.",
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

function FormHarness({ initialData }: { initialData?: CashFlowTransaction | null }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="p-8">
      <Button onPress={() => setOpen(true)}>Abrir formulario</Button>
      <TransactionForm
        categories={CATEGORIES}
        isOpen={open}
        onClose={() => setOpen(false)}
        initialData={initialData ?? null}
      />
    </div>
  );
}

const baseHandlers = [
  http.post("*/api/orpc/finance/rpc/transactionsCreate", () => ok({})),
  http.post("*/api/orpc/finance/rpc/transactionsUpdate", () => ok({})),
];

const meta: Meta<typeof TransactionForm> = {
  title: "Finance/TransactionForm",
  component: TransactionForm,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Modal de creación/edición de movimiento de flujo de caja. Validación Zod inline; en modo edición oculta fecha y monto (no editables) y usa el endpoint de update del router de finanzas.",
      },
    },
    msw: { handlers: baseHandlers },
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
type Story = StoryObj<typeof TransactionForm>;

// Default: nuevo movimiento, formulario vacío.
export const NewTransaction: Story = {
  render: () => <FormHarness />,
};

// Edición: oculta fecha y monto, prellena descripción/categoría/comentario.
export const EditTransaction: Story = {
  render: () => <FormHarness initialData={EDIT_TRANSACTION} />,
};

// Sin categorías disponibles: ListBox muestra el item disabled "No hay
// categorías disponibles".
export const NoCategories: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div className="p-8">
        <Button onPress={() => setOpen(true)}>Abrir formulario</Button>
        <TransactionForm
          categories={[]}
          isOpen={open}
          onClose={() => setOpen(false)}
          initialData={null}
        />
      </div>
    );
  },
};

// Submit error: backend rechaza el create; toast de error se dispara.
export const SaveError: Story = {
  render: () => <FormHarness />,
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/finance/rpc/transactionsCreate", () =>
          HttpResponse.json(
            {
              json: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Error guardando movimiento",
                status: 500,
              },
              meta: [],
            },
            { status: 500 }
          )
        ),
      ],
    },
  },
};
