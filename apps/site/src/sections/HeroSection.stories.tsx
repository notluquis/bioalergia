import type { Meta, StoryObj } from "@storybook/react-vite";

import { HeroSection } from "./HeroSection";

const meta: Meta<typeof HeroSection> = {
  title: "Site/HeroSection",
  component: HeroSection,
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [1280, 768, 390] },
  },
  args: {
    onBook: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof HeroSection>;

export const Default: Story = {};
