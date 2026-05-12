import type { Meta, StoryObj } from "@storybook/react-vite";

import { PerformanceIndicator } from "./PerformanceIndicator";

const meta: Meta<typeof PerformanceIndicator> = {
  title: "Features/PerformanceIndicator",
  component: PerformanceIndicator,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Chip que comunica el modo de rendimiento detectado por `usePerformanceMode` (alto vs optimizado), heurística sobre `navigator.hardwareConcurrency`, `deviceMemory` y conexión. El estado real depende del dispositivo donde se renderiza la story; en CI headless suele caer en `Optimizado`.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof PerformanceIndicator>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <PerformanceIndicator />
      <span className="text-default-500 text-xs">
        El modo se calcula a partir del entorno actual (CPU, RAM, red).
      </span>
    </div>
  ),
};
