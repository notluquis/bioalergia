import { Button } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  args: {
    children: "Continuar",
  },
};

export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: "primary",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
  },
};

export const Danger: Story = {
  args: {
    variant: "danger",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
  },
};

export const Loading: Story = {
  args: {
    isPending: true,
  },
};
