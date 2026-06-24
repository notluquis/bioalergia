import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ConfirmDialogHost } from "@/components/ui/ConfirmDialog";
import { ToastProvider } from "@/context/ToastContext";
import { AccountsPanel } from "./AccountsPanel";

// El panel de cuentas configura las apps de Meta y TikTok y conecta cuentas vía
// OAuth. Todas las queries/mutaciones resuelven contra MSW (getMetaConfig,
// getTiktokConfig, listAccounts con una cuenta Meta + una TikTok, etc).

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

const meta: Meta<typeof AccountsPanel> = {
  title: "Social/AccountsPanel",
  component: AccountsPanel,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Configuración de las apps Meta y TikTok (Client Key/Secret en DB, nunca el secret de vuelta), botones de OAuth y listado de cuentas conectadas. Pre-audit de TikTok las publicaciones son privadas (SELF_ONLY).",
      },
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={makeQueryClient()}>
        <ToastProvider>
          <Story />
          <ConfirmDialogHost />
        </ToastProvider>
      </QueryClientProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AccountsPanel>;

export const Default: Story = {
  name: "Meta + TikTok configurados",
  play: async ({ canvasElement }) => {
    const { expect, within, waitFor } = await import("storybook/test");
    const canvas = within(canvasElement);

    // Ambas secciones de OAuth renderizan.
    await expect(await canvas.findByText("Conexión con Meta (OAuth)")).toBeVisible();
    await expect(await canvas.findByText("Conexión con TikTok (OAuth)")).toBeVisible();

    // El botón de conectar TikTok se habilita una vez que carga la config (MSW).
    const tiktokConnect = await canvas.findByRole("button", { name: /Conectar con TikTok/ });
    await waitFor(async () => {
      await expect(tiktokConnect).toBeEnabled();
    });

    // Listado de cuentas conectadas incluye la cuenta TikTok del fixture.
    await expect(await canvas.findByText("Bioalergia (TikTok)")).toBeVisible();

    // La sección de configuración IA (hero opcional) renderiza.
    await expect(await canvas.findByText("Configuración IA (imagen)")).toBeVisible();
  },
};
