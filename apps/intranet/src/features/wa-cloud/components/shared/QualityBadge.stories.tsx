import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { http, HttpResponse } from "msw";

import { QualityBadge } from "./QualityBadge";

// Per-story QueryClient + minimal in-memory router so the embedded
// `<Link to="/wa-cloud/alertas">` resolves without crashing.

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

function buildRouter(child: React.ReactNode) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div className="p-6">{child}</div>,
  });
  const alertsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/wa-cloud/alertas",
    component: () => null,
  });
  return createRouter({
    routeTree: rootRoute.addChildren([indexRoute, alertsRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
}

const PHONE_ID = 7;

const meta: Meta<typeof QualityBadge> = {
  title: "WaCloud/QualityBadge",
  component: QualityBadge,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Chip de calidad del número WhatsApp (Meta phone quality + alertas no reconocidas). Severidad RED > YELLOW > GREEN; click abre popover con desglose y enlace a alertas.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof QualityBadge>;

function renderBadge() {
  const qc = makeQueryClient();
  return (
    <QueryClientProvider client={qc}>
      <RouterProvider router={buildRouter(<QualityBadge phoneNumberId={PHONE_ID} />)} />
    </QueryClientProvider>
  );
}

export const QualityGreen: Story = {
  name: "Calidad GREEN — todo en orden",
  render: () => renderBadge(),
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/wa-cloud/rpc/getPhoneQualitySummary", () =>
          ok({
            phoneNumberId: PHONE_ID,
            qualityRating: "GREEN",
            criticalUnacknowledged: 0,
            warningUnacknowledged: 0,
            lastEventAt: null,
          })
        ),
      ],
    },
  },
};

export const QualityYellow: Story = {
  name: "Calidad YELLOW — 2 warnings sin reconocer",
  render: () => renderBadge(),
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/wa-cloud/rpc/getPhoneQualitySummary", () =>
          ok({
            phoneNumberId: PHONE_ID,
            qualityRating: "YELLOW",
            criticalUnacknowledged: 0,
            warningUnacknowledged: 2,
            lastEventAt: new Date("2026-05-10T14:22:00Z"),
          })
        ),
      ],
    },
  },
};

export const QualityRedWithCriticals: Story = {
  name: "Calidad RED — pacientes reportaron",
  render: () => renderBadge(),
  parameters: {
    msw: {
      handlers: [
        http.post("*/api/orpc/wa-cloud/rpc/getPhoneQualitySummary", () =>
          ok({
            phoneNumberId: PHONE_ID,
            qualityRating: "RED",
            criticalUnacknowledged: 3,
            warningUnacknowledged: 1,
            lastEventAt: new Date("2026-05-12T09:05:00Z"),
          })
        ),
      ],
    },
  },
};

export const HiddenWhileLoading: Story = {
  name: "Sin datos aún — chip oculto",
  render: () => renderBadge(),
  parameters: {
    msw: {
      handlers: [
        // Never resolves — exercises the `if (!q.data) return null` branch.
        http.post("*/api/orpc/wa-cloud/rpc/getPhoneQualitySummary", () => new Promise(() => {})),
      ],
    },
  },
};
