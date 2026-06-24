import type { Meta, StoryObj } from "@storybook/react-vite";

import { Clock } from "./Clock";

const meta: Meta<typeof Clock> = {
  title: "Features/Clock",
  component: Clock,
  parameters: {
    docs: {
      description: {
        component:
          "Live clock chip in the global header. Polls every second but only re-renders on minute boundaries (`useRef` guard) so the surrounding tree never reconciles between minutes. Uses `es-CL` locale.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof Clock>;

export const Default: Story = {};
