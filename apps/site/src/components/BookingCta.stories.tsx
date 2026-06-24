import type { Meta, StoryObj } from "@storybook/react-vite";

import { BookingCta } from "./BookingCta";

const meta: Meta<typeof BookingCta> = {
  title: "Site/BookingCta",
  component: BookingCta,
};

export default meta;

type Story = StoryObj<typeof BookingCta>;

export const Default: Story = {};

export const CustomCopy: Story = {
  args: {
    title: "Inmunoterapia personalizada",
    description:
      "Conversa con nuestro equipo para diseñar un plan de inmunoterapia adaptado a tu diagnóstico.",
  },
};
