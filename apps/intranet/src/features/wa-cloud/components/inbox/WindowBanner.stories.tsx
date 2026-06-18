import type { Meta, StoryObj } from "@storybook/react-vite";

import { WindowBanner } from "./WindowBanner";

// 24-hour customer-service window banner shown above the composer. Pure (an
// internal setInterval refreshes the countdown). Renders nothing while the
// window is comfortably open (>2h left); shows a live countdown when <2h; and a
// danger "solo plantillas" banner with a "Usar plantilla" button when closed.
//
// "now + X" is computed inside each render fn (never at module top) so SSR /
// snapshot capture doesn't freeze a stale Date.now() across reloads.

const noop = () => {};

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md">{children}</div>;
}

const meta: Meta<typeof WindowBanner> = {
  title: "WaCloud/WindowBanner",
  component: WindowBanner,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Estado de la ventana de atención de 24 h sobre el composer. No muestra nada con la ventana abierta y holgada (>2 h); cuenta regresiva cuando faltan <2 h; y aviso de solo-plantillas cuando está cerrada.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof WindowBanner>;

export const Closed: Story = {
  name: "Cerrada — solo plantillas",
  render: () => (
    <Frame>
      <WindowBanner windowOpen={false} windowExpiresAt={null} onUseTemplate={noop} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/solo puedes enviar plantillas/i)).toBeVisible();
    await expect(canvas.getByRole("button", { name: /Usar plantilla/i })).toBeVisible();
  },
};

export const ExpiringSoon: Story = {
  name: "Por cerrar — cuenta regresiva (~30 min)",
  render: () => (
    <Frame>
      <WindowBanner
        windowOpen
        windowExpiresAt={new Date(Date.now() + 30 * 60 * 1000)}
        onUseTemplate={noop}
      />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/La ventana de respuesta cierra en/i)).toBeVisible();
    await expect(canvas.getByText(/min/i)).toBeVisible();
  },
};

export const OpenFarOut: Story = {
  name: "Abierta y holgada — no renderiza nada (>2 h)",
  render: () => (
    <Frame>
      <WindowBanner
        windowOpen
        windowExpiresAt={new Date(Date.now() + 10 * 60 * 60 * 1000)}
        onUseTemplate={noop}
      />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const { expect } = await import("storybook/test");
    // The component returns null while the window is comfortably open, so the
    // Frame stays empty (no banner text, no button).
    const frame = canvasElement.querySelector("div");
    await expect(frame?.textContent ?? "").toBe("");
    await expect(canvasElement.querySelector("button")).toBeNull();
  },
};
