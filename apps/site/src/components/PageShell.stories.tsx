import type { Meta, StoryObj } from "@storybook/react-vite";

import { Section } from "@/sections/Section";

import { PageShell } from "./PageShell";

const meta: Meta<typeof PageShell> = {
  title: "Site/PageShell",
  component: PageShell,
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [1280, 768, 390] },
  },
};

export default meta;

type Story = StoryObj<typeof PageShell>;

export const Default: Story = {
  args: {
    children: (
      <Section
        eyebrow="Ejemplo"
        title="Contenido de la página"
        subtitle="Este es un contenido de muestra dentro del shell compartido (header + footer)."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-4 text-(--ink-muted)">
            Bloque de contenido A
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4 text-(--ink-muted)">
            Bloque de contenido B
          </div>
        </div>
      </Section>
    ),
  },
};
