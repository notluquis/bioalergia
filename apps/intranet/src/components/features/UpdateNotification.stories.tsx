import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

import { UpdateNotification } from "./UpdateNotification";

const meta: Meta<typeof UpdateNotification> = {
  title: "Features/UpdateNotification",
  component: UpdateNotification,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Toast inferior-derecho que aparece cuando `vite-plugin-pwa` detecta una versión nueva del service worker. Ofrece actualización normal (recarga limpia tras `clearOnlyCaches` + `updateServiceWorker(true)`) y una opción avanzada de limpiar caché. En Storybook se mockea `virtual:pwa-register/react` con un stub que respeta `globalThis.__SB_PWA_FORCE_NEED_REFRESH__`.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof UpdateNotification>;

const FORCE_FLAG = "__SB_PWA_FORCE_NEED_REFRESH__";

function withForceFlag(force: boolean, Story: React.ComponentType) {
  function Wrapper() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
      (globalThis as Record<string, unknown>)[FORCE_FLAG] = force;
      setMounted(true);
      return () => {
        (globalThis as Record<string, unknown>)[FORCE_FLAG] = false;
      };
    }, []);
    if (!mounted) return null;
    return <Story />;
  }
  return <Wrapper />;
}

export const Visible: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Estado activo: el SW reporta una nueva versión. Botones disponibles: Actualizar, Limpiar caché y descartar.",
      },
    },
  },
  render: () =>
    withForceFlag(true, () => (
      <div className="min-h-screen bg-default-50 p-8">
        <p className="text-default-600 text-sm">
          Contenido de fondo. El toast aparece anclado al borde inferior derecho.
        </p>
        <UpdateNotification />
      </div>
    )),
};

export const Hidden: Story = {
  parameters: {
    docs: {
      description: {
        story: "Estado por defecto: sin actualización pendiente el componente no renderiza nada.",
      },
    },
  },
  render: () =>
    withForceFlag(false, () => (
      <div className="min-h-screen bg-default-50 p-8 text-default-600 text-sm">
        Sin actualización pendiente — el componente está montado pero invisible.
        <UpdateNotification />
      </div>
    )),
};
