import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import TimeInput from "./TimeInput";

const meta: Meta<typeof TimeInput> = {
  title: "UI/TimeInput",
  component: TimeInput,
};

export default meta;

type Story = StoryObj<typeof TimeInput>;

export const Basic: Story = {
  render: () => {
    const [value, setValue] = useState("08:30");

    return (
      <div className="max-w-[140px]">
        <TimeInput value={value} onChange={setValue} />
      </div>
    );
  },
};

export const Empty: Story = {
  render: () => {
    const [value, setValue] = useState("");

    return (
      <div className="max-w-[140px]">
        <TimeInput value={value} onChange={setValue} />
      </div>
    );
  },
};
