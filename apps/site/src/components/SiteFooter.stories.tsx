import type { Meta, StoryObj } from "@storybook/react-vite";

import { SiteFooter } from "./SiteFooter";

const meta: Meta<typeof SiteFooter> = {
  title: "Site/SiteFooter",
  component: SiteFooter,
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [1280, 768, 390] },
  },
};

export default meta;

type Story = StoryObj<typeof SiteFooter>;

export const Default: Story = {};
