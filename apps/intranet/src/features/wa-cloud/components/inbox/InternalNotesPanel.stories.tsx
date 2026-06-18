import type { Meta, StoryObj } from "@storybook/react-vite";

import { InternalNotesPanel } from "./InternalNotesPanel";

// Team-only conversation notes, surfaced as a header button that opens a
// HeroUI Popover (React Aria → portalled into document.body) with a textarea.
// Pure props (onSave callback, no MSW). The button shows a warning dot when
// notes exist. The play() opens the popover and asserts the textarea + Guardar
// land in the portalled dialog.

const noop = () => {};

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center p-8">{children}</div>;
}

const meta: Meta<typeof InternalNotesPanel> = {
  title: "WaCloud/InternalNotesPanel",
  component: InternalNotesPanel,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Notas internas del equipo sobre una conversación (nunca se envían al paciente). Botón en el header con un punto cuando hay contenido; al abrir muestra un textarea para traspasos de turno.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof InternalNotesPanel>;

export const Empty: Story = {
  name: "Sin notas",
  render: () => (
    <Row>
      <InternalNotesPanel notas={null} onSave={noop} isPending={false} />
    </Row>
  ),
  play: async ({ canvasElement }) => {
    const { expect, userEvent, within } = await import("storybook/test");
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const body = within(doc.body);

    const trigger = canvas.getByRole("button", { name: "Notas internas del equipo" });
    await userEvent.click(trigger);

    // Popover content is portalled into document.body — wait for it.
    const dialog = await body.findByRole("dialog", { name: "Notas internas del equipo" });
    await expect(dialog).toBeVisible();
    const inDialog = within(dialog);
    await expect(inDialog.getByRole("textbox", { name: "Notas internas" })).toBeVisible();
    await expect(inDialog.getByRole("button", { name: "Guardar" })).toBeVisible();
  },
};

export const WithNotes: Story = {
  name: "Con notas — punto de aviso",
  render: () => (
    <Row>
      <InternalNotesPanel
        notas="Paciente ansioso por el examen; confirmar receta con Dra. mañana."
        onSave={noop}
        isPending={false}
      />
    </Row>
  ),
  play: async ({ canvasElement }) => {
    const { expect, userEvent, within } = await import("storybook/test");
    const doc = canvasElement.ownerDocument;
    const canvas = within(canvasElement);
    const body = within(doc.body);

    const trigger = canvas.getByRole("button", {
      name: "Notas internas del equipo (con contenido)",
    });
    await userEvent.click(trigger);

    const dialog = await body.findByRole("dialog", { name: "Notas internas del equipo" });
    await expect(dialog).toBeVisible();
    const inDialog = within(dialog);
    const textarea = inDialog.getByRole("textbox", { name: "Notas internas" });
    await expect(textarea).toHaveValue(
      "Paciente ansioso por el examen; confirmar receta con Dra. mañana."
    );
    await expect(inDialog.getByRole("button", { name: "Guardar" })).toBeVisible();
  },
};
