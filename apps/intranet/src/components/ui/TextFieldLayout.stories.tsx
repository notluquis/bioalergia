import { Input, Label, TextArea, TextField } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

// `storybook/test` and the layout-guards helpers are dynamically imported
// inside each `play` only — top-level import would crash Chromatic's
// headless story extractor with
// "Cannot read properties of undefined (reading 'customEqualityTesters')"
// because the extractor evaluates story files without Vitest's expect
// runtime in scope.

/**
 * Layout regression coverage for HeroUI v3 TextField / TextArea.
 *
 * Catches the "one letter per line" collapse where a flex child without
 * `min-width:0` squeezes the input to ~12px and the browser stacks glyphs
 * vertically (writing-mode stays horizontal-tb but width drops below 4ch).
 *
 * The story renders the field inside an intentionally narrow flex container
 * (80px) WITHOUT applying `min-w-0`, mimicking the buggy parent layout.
 * Asserts that HeroUI's own min-width handling keeps the input above 4ch.
 * If this story fails, it is a real bug worth surfacing.
 */
const meta: Meta = {
  title: "UI/TextFieldLayout",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj;

export const NarrowFlexContainerInput: Story = {
  render: () => (
    <div style={{ display: "flex", width: 80 }}>
      <TextField defaultValue="hello world">
        <Label>Comment</Label>
        <Input placeholder="Type here" />
      </TextField>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { within } = await import("storybook/test");
    const { expectHorizontalTextFlow } = await import("../../test/layout-guards");
    const root = within(canvasElement);
    const input = root.getByPlaceholderText("Type here") as HTMLInputElement;
    expectHorizontalTextFlow(input);
  },
};

export const NarrowFlexContainerTextarea: Story = {
  render: () => (
    <div style={{ display: "flex", width: 80 }}>
      <TextField defaultValue="hello world">
        <Label>Notes</Label>
        <TextArea placeholder="Long notes go here" rows={3} />
      </TextField>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { within } = await import("storybook/test");
    const { expectHorizontalTextFlow } = await import("../../test/layout-guards");
    const root = within(canvasElement);
    const textarea = root.getByPlaceholderText(
      "Long notes go here"
    ) as HTMLTextAreaElement;
    expectHorizontalTextFlow(textarea);
  },
};

export const LongLabelNoSilentClip: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        width: 120,
        overflow: "hidden",
      }}
    >
      <TextField defaultValue="x">
        <Label>Comentarios adicionales del paciente sobre alergias</Label>
        <Input placeholder="x" />
      </TextField>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { within } = await import("storybook/test");
    const { expectNoSilentClipping } = await import("../../test/layout-guards");
    const root = within(canvasElement);
    const label = root.getByText(/Comentarios adicionales/);
    expectNoSilentClipping(label as HTMLElement);
  },
};
