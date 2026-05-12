import type { Meta, StoryObj } from "@storybook/react-vite";

import { Section } from "./Section";

const meta: Meta<typeof Section> = {
  title: "Site/Section",
  component: Section,
};

export default meta;

type Story = StoryObj<typeof Section>;

export const Default: Story = {
  args: {
    eyebrow: "Especialidades",
    title: "Atención personalizada",
    subtitle:
      "Equipo clínico dedicado a diagnóstico preciso, tratamientos personalizados y seguimiento continuo.",
    children: (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4 text-(--ink-muted)">
          Evaluación integral de alergias
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 text-(--ink-muted)">
          Programas de inmunoterapia
        </div>
      </div>
    ),
  },
};
