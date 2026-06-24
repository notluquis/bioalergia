import type { Meta, StoryObj } from "@storybook/react-vite";

import { ScrollToBottomFab } from "./ScrollToBottomFab";

// Floating "ir al final" control over the message feed. Pure presentational;
// no MSW, no backend. The component is absolutely positioned, so each story
// renders it inside a `relative h-40` box to give the FAB a frame to anchor to.
// Stories cover: no badge (newCount=0), a small badge (7) and the "99+" cap.

const meta: Meta<typeof ScrollToBottomFab> = {
  title: "WaCloud/ScrollToBottomFab",
  component: ScrollToBottomFab,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Botón flotante para volver al último mensaje. Muestra una píldora con el conteo de mensajes nuevos cuando newCount>0; el aria-label refleja el conteo.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ScrollToBottomFab>;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto h-40 max-w-md overflow-hidden rounded-xl bg-content2/40">
      {children}
    </div>
  );
}

export const SinBadge: Story = {
  name: "Sin badge — newCount=0",
  render: () => (
    <Frame>
      <ScrollToBottomFab newCount={0} onPress={() => {}} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const canvas = within(canvasElement);
    const fab = canvas.getByRole("button", { name: "Ir al final" });
    await expect(fab).toBeVisible();
  },
};

export const ConBadge: Story = {
  name: "Con badge — newCount=7",
  render: () => (
    <Frame>
      <ScrollToBottomFab newCount={7} onPress={() => {}} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const canvas = within(canvasElement);
    const fab = canvas.getByRole("button", { name: "7 mensajes nuevos, ir al final" });
    await expect(fab).toBeVisible();
  },
};

export const BadgeMaxed: Story = {
  name: "Badge tope — newCount=120 (99+)",
  render: () => (
    <Frame>
      <ScrollToBottomFab newCount={120} onPress={() => {}} />
    </Frame>
  ),
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const canvas = within(canvasElement);
    const fab = canvas.getByRole("button", { name: "120 mensajes nuevos, ir al final" });
    await expect(fab).toBeVisible();
  },
};
