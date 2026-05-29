import { Label, NumberField } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Layout regression coverage for HeroUI v3 NumberField.
 *
 * Catches the value-clipping bug where `.number-field__group` is a 3-column
 * grid (`grid-template-columns: 40px 1fr 40px`) sized for
 * [DecrementButton][Input][IncrementButton]. When the steppers are omitted —
 * our default for plain numeric entry — the lone `<NumberField.Input>`
 * auto-places into the first 40px column and horizontally clips any value
 * wider than ~40px (currency "$212.500", decimals "0,5"). The DOM value is
 * correct; only the render width is wrong, so jsdom/axe/value-assertion tests
 * are all blind to it — this visual story is the regression net.
 *
 * The fix is `className="grid-cols-1"` on the stepperless Group (flattens the
 * grid to a single full-width column). These stories render the FIXED
 * composition with realistic wide values and assert the input keeps a
 * horizontal, non-clipped flow. If a NumberField regresses to the bare
 * 40px-column layout, expectHorizontalTextFlow drops below 4ch and fails.
 */
const meta: Meta = {
  title: "UI/NumberFieldLayout",
  parameters: { layout: "centered" },
};
export default meta;

type Story = StoryObj;

/** Wide CLP currency value — the worst clipping case (immunotherapy stages, salaries, prices). */
export const StepperlessCurrency: Story = {
  render: () => (
    <div style={{ width: 240 }}>
      <NumberField
        defaultValue={212_500}
        formatOptions={{ style: "currency", currency: "CLP" }}
        minValue={0}
      >
        <Label>Precio</Label>
        <NumberField.Group className="grid-cols-1">
          <NumberField.Input />
        </NumberField.Group>
      </NumberField>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { expectHorizontalTextFlow, expectNoSilentClipping } =
      await import("../../test/layout-guards");
    const input = canvasElement.querySelector(".number-field__input") as HTMLInputElement;
    expectHorizontalTextFlow(input);
    expectNoSilentClipping(input);
  },
};

/** Decimal value (mL / UF style) — clips the fraction digits in the 40px column. */
export const StepperlessDecimal: Story = {
  render: () => (
    <div style={{ width: 240 }}>
      <NumberField
        defaultValue={0.25}
        formatOptions={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
        minValue={0}
      >
        <Label>Tramo de ajuste (mL)</Label>
        <NumberField.Group className="grid-cols-1">
          <NumberField.Input />
        </NumberField.Group>
      </NumberField>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { expectHorizontalTextFlow, expectNoSilentClipping } =
      await import("../../test/layout-guards");
    const input = canvasElement.querySelector(".number-field__input") as HTMLInputElement;
    expectHorizontalTextFlow(input);
    expectNoSilentClipping(input);
  },
};

/** Control: with steppers the native 3-column grid is correct (input in the 1fr column). */
export const WithSteppers: Story = {
  render: () => (
    <div style={{ width: 240 }}>
      <NumberField defaultValue={11} minValue={0}>
        <Label>Cantidad</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input />
          <NumberField.IncrementButton />
        </NumberField.Group>
      </NumberField>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const { expectHorizontalTextFlow } = await import("../../test/layout-guards");
    const input = canvasElement.querySelector(".number-field__input") as HTMLInputElement;
    expectHorizontalTextFlow(input);
  },
};
