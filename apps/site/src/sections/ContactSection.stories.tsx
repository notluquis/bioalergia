import type { Meta, StoryObj } from "@storybook/react-vite";

import { ContactSection } from "./ContactSection";

const meta: Meta<typeof ContactSection> = {
  title: "Site/ContactSection",
  component: ContactSection,
};

export default meta;

type Story = StoryObj<typeof ContactSection>;

export const Default: Story = {};
