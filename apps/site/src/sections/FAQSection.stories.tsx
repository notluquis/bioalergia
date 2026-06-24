import type { Meta, StoryObj } from "@storybook/react-vite";

import { FAQSection } from "./FAQSection";

const meta: Meta<typeof FAQSection> = {
  title: "Site/FAQSection",
  component: FAQSection,
};

export default meta;

type Story = StoryObj<typeof FAQSection>;

export const Default: Story = {};
