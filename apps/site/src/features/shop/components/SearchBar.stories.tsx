import type { Meta, StoryObj } from "@storybook/react-vite";

import { SearchBar } from "./SearchBar";

// El buscador hace autocomplete debounced contra catalog.list. El popover de
// resultados sólo aparece tras escribir ≥2 chars + foco, por lo que el snapshot
// por defecto captura el campo cerrado. La query la responde el handler MSW
// global (catalog.list → 5 productos), así que al escribir se ve la lista real.
const meta: Meta<typeof SearchBar> = {
  title: "Shop/SearchBar",
  component: SearchBar,
  parameters: {
    layout: "padded",
    chromatic: { viewports: [1280, 390] },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SearchBar>;

export const Default: Story = {};
