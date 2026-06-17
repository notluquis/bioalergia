import type { Meta, StoryObj } from "@storybook/react-vite";

import { PrimaryNav } from "./PrimaryNav";

// Snapshotea el nav con la ruta activa marcada a varios anchos para que
// Chromatic detecte regresiones del estado activo y del strip scrolleable en
// móvil (antes el nav no marcaba la página actual y no había cobertura).
const meta: Meta<typeof PrimaryNav> = {
  title: "Site/PrimaryNav",
  component: PrimaryNav,
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [1280, 768, 390] },
  },
  decorators: [
    (Story) => (
      <div className="rounded-2xl border border-border bg-(--surface)">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof PrimaryNav>;

export const Home: Story = {
  args: { pathname: "/" },
};

export const Inmunoterapia: Story = {
  args: { pathname: "/inmunoterapia" },
};

export const Examenes: Story = {
  args: { pathname: "/examenes" },
};

export const NestedRoute: Story = {
  name: "Ruta anidada (/aprende/rinitis)",
  args: { pathname: "/aprende/rinitis" },
};
