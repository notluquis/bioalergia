import type { Meta, StoryObj } from "@storybook/react-vite";

import { SiteHeader } from "./SiteHeader";

// Snapshotea el header a varios anchos para que Chromatic detecte regresiones
// de layout del nav (apretado / wrap feo) — antes no había story y el CI no lo veía.
const meta: Meta<typeof SiteHeader> = {
  title: "Site/SiteHeader",
  component: SiteHeader,
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [1280, 1024, 768, 390] },
  },
};

export default meta;

type Story = StoryObj<typeof SiteHeader>;

export const Default: Story = {};
