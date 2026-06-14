import type { Meta, StoryObj } from "@storybook/react-vite";

import { ServicesSection } from "./ServicesSection";

const meta: Meta<typeof ServicesSection> = {
  title: "Site/ServicesSection",
  component: ServicesSection,
};

export default meta;

type Story = StoryObj<typeof ServicesSection>;

export const Default: Story = {};
