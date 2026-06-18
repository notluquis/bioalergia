import type { Meta, StoryObj } from "@storybook/react-vite";

import { AssignmentControl } from "./AssignmentControl";

// Shared-inbox ownership control rendered in the conversation header. Pure
// props (no data hooks / MSW). Three visual states: unassigned (outline
// "Asignármela"), mine (chip "Asignada a ti" + release), and someone else's
// (warning chip + "Tomar"). `on*` props are auto-spied (argTypesRegex in
// preview), so the Unassigned play() can assert the click reaches onAssignToMe.

const noop = () => {};

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center p-8">{children}</div>;
}

const meta: Meta<typeof AssignmentControl> = {
  title: "WaCloud/AssignmentControl",
  component: AssignmentControl,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          'Control de propiedad del inbox compartido: distingue "sin asignar", "asignada a ti" y "asignada a otra persona" sin exponer nombres de colegas. Evita que dos personas respondan al mismo paciente.',
      },
    },
  },
  render: (args) => (
    <Row>
      <AssignmentControl {...args} />
    </Row>
  ),
};

export default meta;
type Story = StoryObj<typeof AssignmentControl>;

export const Unassigned: Story = {
  name: "Sin asignar — Asignármela",
  args: {
    assignedToUserId: null,
    currentUserId: 42,
    onAssignToMe: noop,
    onRelease: noop,
    isPending: false,
  },
  play: async ({ canvasElement, args }) => {
    const { expect, userEvent, within } = await import("storybook/test");
    const canvas = within(canvasElement);

    const btn = canvas.getByRole("button", { name: "Asignármela" });
    await expect(btn).toBeVisible();
    await userEvent.click(btn);
    // args.onAssignToMe is an auto-spy (parameters.actions argTypesRegex "^on[A-Z].*").
    await expect(args.onAssignToMe).toHaveBeenCalledTimes(1);
  },
};

export const Mine: Story = {
  name: "Asignada a ti — chip + liberar",
  args: {
    assignedToUserId: 42,
    currentUserId: 42,
    onAssignToMe: noop,
    onRelease: noop,
    isPending: false,
  },
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Asignada a ti")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Liberar asignación" })).toBeVisible();
  },
};

export const Other: Story = {
  name: "Asignada a otra persona — Tomar",
  args: {
    assignedToUserId: 7,
    currentUserId: 42,
    onAssignToMe: noop,
    onRelease: noop,
    isPending: false,
  },
  play: async ({ canvasElement }) => {
    const { expect, within } = await import("storybook/test");
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Asignada a otra persona")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Tomar" })).toBeVisible();
  },
};
