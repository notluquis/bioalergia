import type { Meta, StoryObj } from "@storybook/react-vite";

import { MissionSection } from "./MissionSection";

const meta: Meta<typeof MissionSection> = {
  title: "Site/MissionSection",
  component: MissionSection,
};

export default meta;

type Story = StoryObj<typeof MissionSection>;

export const Default: Story = {};
