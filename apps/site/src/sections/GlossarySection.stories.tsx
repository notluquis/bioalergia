import type { Meta, StoryObj } from "@storybook/react-vite";

import { GlossarySection } from "./GlossarySection";

const meta: Meta<typeof GlossarySection> = {
  title: "Site/GlossarySection",
  component: GlossarySection,
};

export default meta;

type Story = StoryObj<typeof GlossarySection>;

export const Default: Story = {};
