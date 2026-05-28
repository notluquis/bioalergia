import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { Button } from "@heroui/react";

import { ShipmentTrackingModal } from "./ShipmentTrackingModal";

// Stories for the Chilexpress tracking modal. Reads `shipments.trackShipment`
// via TanStack Query when open + shipmentId. Variants exercise: timeline
// con eventos completos hasta entregado, en reparto, sin eventos aún,
// rechazado/devolución, sin tracking, y skeleton de loading.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

const DELIVERED_EVENTS = [
  {
    description: "Entregado al destinatario",
    location: "Las Condes, Región Metropolitana",
    date: "2026-05-12 14:32",
  },
  {
    description: "En reparto",
    location: "Centro de distribución Vitacura",
    date: "2026-05-12 09:10",
  },
  {
    description: "En tránsito hacia centro de distribución",
    location: "Aeropuerto SCL",
    date: "2026-05-11 22:45",
  },
  {
    description: "Admitido en oficina origen",
    location: "Sucursal Las Condes Apoquindo",
    date: "2026-05-11 16:20",
  },
];

const IN_TRANSIT_EVENTS = [
  {
    description: "En reparto",
    location: "Centro de distribución Vitacura",
    date: "2026-05-13 08:00",
  },
  {
    description: "En tránsito",
    location: "Camión de larga distancia",
    date: "2026-05-12 22:00",
  },
  {
    description: "Recepcionado en oficina origen",
    location: "Sucursal Las Condes Apoquindo",
    date: "2026-05-12 17:15",
  },
];

const REJECTED_EVENTS = [
  {
    description: "Devolución a remitente",
    location: "Centro de distribución Vitacura",
    date: "2026-05-13 11:20",
  },
  {
    description: "Entrega fallida — destinatario ausente",
    location: "Las Condes",
    date: "2026-05-13 09:05",
  },
  {
    description: "En reparto",
    location: "Centro de distribución Vitacura",
    date: "2026-05-13 07:40",
  },
];

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

function ModalHarness() {
  const [open, setOpen] = useState(true);
  return (
    <div className="p-8">
      <Button onPress={() => setOpen(true)}>Abrir tracking</Button>
      <ShipmentTrackingModal
        isOpen={open}
        onClose={() => setOpen(false)}
        shipmentId={555}
        otNumber="CX-9988776"
      />
    </div>
  );
}

const meta: Meta<typeof ShipmentTrackingModal> = {
  title: "Shipments/ShipmentTrackingModal",
  component: ShipmentTrackingModal,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Modal de tracking Chilexpress para una OT. Pinta línea de tiempo invertida (último evento arriba) con icono y color por tipo de evento. Sin eventos muestra mensaje neutro; sin data muestra estado vacío.",
      },
    },
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
type Story = StoryObj<typeof ShipmentTrackingModal>;

// Default: paquete entregado, 4 eventos en timeline.
export const Delivered: Story = {
  render: () => <ModalHarness />,
  // addon-vitest interaction — modal renders, dialog reachable to AT.
  // (Use `toBeInTheDocument` not `toBeVisible`: HeroUI Modal Backdrop
  // animates in via framer-motion; jsdom doesn't tick the opacity
  // transition, so `toBeVisible` flakes even though the dialog is
  // mounted and accessible to assistive tech.)
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const root = within(canvasElement.ownerDocument.body);
    const dialog = await root.findByRole("dialog");
    await expect(dialog).toBeInTheDocument();
  },
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/shipments/rpc/trackShipment", () =>
          ok({
            tracking: {
              status: "ENT",
              statusDescription: "Entregado al destinatario",
              events: DELIVERED_EVENTS,
            },
          })
        ),
      ],
    },
  },
};

// En reparto — chip accent, timeline con 3 eventos.
export const InTransit: Story = {
  render: () => <ModalHarness />,
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/shipments/rpc/trackShipment", () =>
          ok({
            tracking: {
              status: "RUTA",
              statusDescription: "En ruta de distribución",
              events: IN_TRANSIT_EVENTS,
            },
          })
        ),
      ],
    },
  },
};

// Sin eventos: OT recién creada, Chilexpress no ha registrado actividad.
export const NoEventsYet: Story = {
  render: () => <ModalHarness />,
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/shipments/rpc/trackShipment", () =>
          ok({
            tracking: {
              status: "P",
              statusDescription: "Pendiente de retiro",
              events: [],
            },
          })
        ),
      ],
    },
  },
};

// Devolución: chip danger, eventos de entrega fallida + devolución.
export const Rejected: Story = {
  render: () => <ModalHarness />,
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/shipments/rpc/trackShipment", () =>
          ok({
            tracking: {
              status: "DEV",
              statusDescription: "Devolución en proceso",
              events: REJECTED_EVENTS,
            },
          })
        ),
      ],
    },
  },
};

// Loading: skeleton mientras la query no resuelve.
export const Loading: Story = {
  render: () => <ModalHarness />,
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/shipments/rpc/trackShipment", async () => {
          await new Promise((resolve) => setTimeout(resolve, 60_000));
          return ok({
            tracking: { status: null, statusDescription: null, events: [] },
          });
        }),
      ],
    },
  },
};
