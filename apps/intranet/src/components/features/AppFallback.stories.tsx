import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";

import { signalAppFallback } from "@/lib/app-recovery";

import { AppFallback } from "./AppFallback";

const meta: Meta<typeof AppFallback> = {
  title: "Features/AppFallback",
  component: AppFallback,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Modal de recuperación global. Se muestra cuando el shell pre-mount detecta un fallo (`window.__APP_FALLBACK_REASON__`), cuando alguien dispara `signalAppFallback(reason)` o cuando el navegador entra en `offline`. Cuatro razones (`chunk`, `offline`, `update`, `unknown`) personalizan título / cuerpo / CTA. La acción secundaria abre un confirm que limpia caches con `clearAppCaches()` antes de recargar.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof AppFallback>;

function Trigger({ reason }: { reason: "chunk" | "offline" | "update" | "unknown" }) {
  useEffect(() => {
    // Defer so AppFallback subscribes before we emit.
    const id = setTimeout(() => signalAppFallback(reason), 0);
    return () => clearTimeout(id);
  }, [reason]);
  return <AppFallback />;
}

export const ChunkLoadFailure: Story = {
  render: () => <Trigger reason="chunk" />,
};

export const Offline: Story = {
  render: () => <Trigger reason="offline" />,
};

export const UpdateAvailable: Story = {
  render: () => <Trigger reason="update" />,
};

export const UnknownError: Story = {
  render: () => <Trigger reason="unknown" />,
};

export const Hidden: Story = {
  parameters: {
    docs: {
      description: {
        story: "Estado por defecto: sin razón activa el componente no renderiza nada.",
      },
    },
  },
  render: () => (
    <div className="p-8 text-default-600 text-sm">
      <AppFallback />
      AppFallback montado pero inactivo.
    </div>
  ),
};
