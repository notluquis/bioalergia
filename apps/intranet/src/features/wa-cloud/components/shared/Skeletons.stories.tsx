import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  WaCardGridSkeleton,
  WaListSkeleton,
  WaSettingsSkeleton,
  WaTableSkeleton,
} from "./Skeletons";

// Pure presentational skeletons — no data, no MSW. Each variant mirrors
// the eventual content shape so the layout doesn't jump on load.

const meta: Meta = {
  title: "WaCloud/Skeletons",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Esqueletos compartidos para vistas wa-cloud (lista, grilla de tarjetas, tabla, página de ajustes). Mantienen el layout estable mientras llega la data real.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const ListDefault: Story = {
  name: "Lista — bandeja (6 filas)",
  render: () => (
    <div className="mx-auto max-w-md border border-default-200 bg-content1">
      <WaListSkeleton />
    </div>
  ),
};

export const CardGridThreeColumns: Story = {
  name: "Grilla — plantillas (3 columnas)",
  render: () => (
    <div className="mx-auto max-w-5xl">
      <WaCardGridSkeleton />
    </div>
  ),
};

export const CardGridFourColumns: Story = {
  name: "Grilla — catálogo (4 columnas, 8 tarjetas)",
  render: () => (
    <div className="mx-auto max-w-6xl">
      <WaCardGridSkeleton cards={8} columns={4} />
    </div>
  ),
};

export const Table: Story = {
  name: "Tabla — webhook logs (8 x 5)",
  render: () => (
    <div className="mx-auto max-w-4xl border border-default-200 bg-content1">
      <WaTableSkeleton />
    </div>
  ),
};

export const Settings: Story = {
  name: "Ajustes — título + 2 tarjetas",
  render: () => <WaSettingsSkeleton />,
};
