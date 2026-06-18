import type { Meta, StoryObj } from "@storybook/react-vite";

import { UnreadDivider } from "./UnreadDivider";

// "N mensajes nuevos" separator dropped before the first unread inbound message
// when a conversation opens. Pure presentational; no MSW, no backend. Stories
// cover singular vs plural copy and assert the role="separator" boundary
// screen readers announce.

const meta: Meta<typeof UnreadDivider> = {
  title: "WaCloud/UnreadDivider",
  component: UnreadDivider,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'Separador de mensajes no leídos en el feed del chat. role="separator" + aria-label con el conteo ("N mensajes nuevos").',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof UnreadDivider>;

function Row({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-md space-y-3 bg-content2/40 p-4">{children}</div>;
}

export const Singular: Story = {
  name: "Singular — 1 mensaje nuevo",
  render: () => (
    <Row>
      <UnreadDivider count={1} />
    </Row>
  ),
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const canvas = within(canvasElement);
    const sep = canvas.getByRole("separator", { name: "1 mensaje nuevo" });
    await expect(sep).toBeVisible();
  },
};

export const Plural: Story = {
  name: "Plural — 12 mensajes nuevos",
  render: () => (
    <Row>
      <UnreadDivider count={12} />
    </Row>
  ),
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const canvas = within(canvasElement);
    const sep = canvas.getByRole("separator", { name: "12 mensajes nuevos" });
    await expect(sep).toBeVisible();
  },
};
