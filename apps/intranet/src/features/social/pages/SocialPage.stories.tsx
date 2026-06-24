import { I18nProvider } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import type { SocialTab } from "../types";
import { SocialPage } from "./SocialPage";

// Full approval-panel page with its tabbed layout (Calendario / Pendientes /
// Publicados / Cuentas). Posts + accounts resolve via the default MSW social
// handlers. The story defaults to the "Pendientes" tab so the posts table
// renders without booting the lazy FullCalendar bundle.

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

function PageHarness({ initialTab }: { initialTab: SocialTab }) {
  const [tab, setTab] = useState<SocialTab>(initialTab);
  return <SocialPage tab={tab} onTabChange={setTab} />;
}

const meta: Meta<typeof SocialPage> = {
  title: "Social/SocialPage",
  component: SocialPage,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Panel de aprobación de redes sociales con pestañas (Calendario, Borradores/Pendientes, Publicados, Cuentas). Publicaciones y cuentas vía MSW.",
      },
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
type Story = StoryObj<typeof SocialPage>;

export const Pendientes: Story = {
  name: "Pestaña Pendientes",
  render: () => <PageHarness initialTab="pendientes" />,
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Redes sociales" })).toBeVisible();
    await expect(await canvas.findByText(/Promo invierno/)).toBeVisible();
  },
};

export const Publicados: Story = {
  name: "Pestaña Publicados",
  render: () => <PageHarness initialTab="publicados" />,
};

export const Cuentas: Story = {
  name: "Pestaña Cuentas",
  render: () => <PageHarness initialTab="cuentas" />,
};
