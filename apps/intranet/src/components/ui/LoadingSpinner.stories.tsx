import type { Meta, StoryObj } from "@storybook/react-vite";

import { LoadingSpinner } from "./LoadingSpinner";

const meta: Meta<typeof LoadingSpinner> = {
  title: "UI/LoadingSpinner",
  component: LoadingSpinner,
  parameters: {
    docs: {
      description: {
        component:
          'ARIA-safe wrapper around HeroUI v3 `<Spinner />`. The bare HeroUI component lacks `role`/`aria-label` slots and trips axe `aria-prohibited-attr`; this wrapper provides `role="status"` + `aria-live="polite"` + sr-only label.',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof LoadingSpinner>;

export const Default: Story = {};

export const Small: Story = {
  args: { size: "sm" },
};

export const Large: Story = {
  args: { size: "lg" },
};

export const ColorAccent: Story = {
  args: { color: "accent", size: "lg" },
};

export const ColorDanger: Story = {
  args: { color: "danger", size: "lg" },
};

export const CustomLabel: Story = {
  args: { label: "Procesando solicitud", size: "lg" },
};
