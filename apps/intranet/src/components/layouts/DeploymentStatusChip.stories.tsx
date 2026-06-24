import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse } from "msw";
import { useEffect } from "react";

import { AbilityProvider } from "@/lib/authz/AbilityProvider";
import { updateAbility } from "@/lib/authz/ability";

import { DeploymentStatusChip } from "./DeploymentStatusChip";

const meta: Meta<typeof DeploymentStatusChip> = {
  title: "Layouts/DeploymentStatusChip",
  component: DeploymentStatusChip,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Chip resumen del estado de los deploys de Railway en el header. Polea cada 15s. Color y texto se calculan desde el peor estado del fanout (`SUCCESS` → verde, `BUILDING/QUEUED/...` → ámbar, `CRASHED/FAILED` → rojo). Tooltip detalla cada servicio. Renderiza `null` si el usuario carece del permiso `read:Integration`.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof DeploymentStatusChip>;

const RAILWAY_URL = "*/api/orpc/system/rpc/deployments";

const ok = (data: unknown) => HttpResponse.json({ json: data, meta: [] });

const NOW = new Date("2026-05-12T15:00:00Z").toISOString();
const TEN_MIN_AGO = new Date("2026-05-12T14:50:00Z").toISOString();
const ONE_HOUR_AGO = new Date("2026-05-12T14:00:00Z").toISOString();

function GrantIntegrationRead({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    updateAbility([{ action: "read", subject: "Integration" }]);
    return () => {
      updateAbility([]);
    };
  }, []);
  return <>{children}</>;
}

function withProviders(Story: React.ComponentType, granted = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return (
    <QueryClientProvider client={client}>
      <AbilityProvider>
        {granted ? (
          <GrantIntegrationRead>
            <Story />
          </GrantIntegrationRead>
        ) : (
          <Story />
        )}
      </AbilityProvider>
    </QueryClientProvider>
  );
}

export const Stable: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post(RAILWAY_URL, () =>
          ok({
            checkedAt: NOW,
            configured: true,
            errorMessage: null,
            targets: [
              {
                createdAt: ONE_HOUR_AGO,
                deploymentId: "dep_success_aaaaaaaa",
                environmentId: "env_prod",
                label: "api · production",
                serviceId: "svc_api",
                status: "SUCCESS",
              },
              {
                createdAt: ONE_HOUR_AGO,
                deploymentId: "dep_success_bbbbbbbb",
                environmentId: "env_prod",
                label: "intranet · production",
                serviceId: "svc_intranet",
                status: "SUCCESS",
              },
            ],
          })
        ),
      ],
    },
  },
  render: () => withProviders(() => <DeploymentStatusChip />),
};

export const Building: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post(RAILWAY_URL, () =>
          ok({
            checkedAt: NOW,
            configured: true,
            errorMessage: null,
            targets: [
              {
                createdAt: TEN_MIN_AGO,
                deploymentId: "dep_building_cccccccc",
                environmentId: "env_prod",
                label: "api · production",
                serviceId: "svc_api",
                status: "BUILDING",
              },
            ],
          })
        ),
      ],
    },
  },
  render: () => withProviders(() => <DeploymentStatusChip />),
};

export const Failed: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post(RAILWAY_URL, () =>
          ok({
            checkedAt: NOW,
            configured: true,
            errorMessage: null,
            targets: [
              {
                createdAt: TEN_MIN_AGO,
                deploymentId: "dep_failed_dddddddd",
                environmentId: "env_prod",
                label: "api · production",
                serviceId: "svc_api",
                status: "FAILED",
              },
              {
                createdAt: ONE_HOUR_AGO,
                deploymentId: "dep_success_eeeeeeee",
                environmentId: "env_prod",
                label: "intranet · production",
                serviceId: "svc_intranet",
                status: "SUCCESS",
              },
            ],
          })
        ),
      ],
    },
  },
  render: () => withProviders(() => <DeploymentStatusChip />),
};

export const Compact: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post(RAILWAY_URL, () =>
          ok({
            checkedAt: NOW,
            configured: true,
            errorMessage: null,
            targets: [
              {
                createdAt: ONE_HOUR_AGO,
                deploymentId: "dep_success_ffffffff",
                environmentId: "env_prod",
                label: "api · production",
                serviceId: "svc_api",
                status: "SUCCESS",
              },
            ],
          })
        ),
      ],
    },
  },
  render: () => withProviders(() => <DeploymentStatusChip compact />),
};

export const NotConfigured: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post(RAILWAY_URL, () =>
          ok({
            checkedAt: NOW,
            configured: false,
            errorMessage: null,
            targets: [],
          })
        ),
      ],
    },
  },
  render: () => withProviders(() => <DeploymentStatusChip />),
};

export const WithoutPermission: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Sin permiso `read:Integration` el componente no renderiza nada — sólo administradores ven el chip.",
      },
    },
  },
  render: () =>
    withProviders(
      () => (
        <div className="flex items-center gap-2 text-default-600 text-sm">
          <DeploymentStatusChip />
          <span>(sin chip — falta permiso)</span>
        </div>
      ),
      false
    ),
};
