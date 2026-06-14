import type { Meta, StoryObj } from "@storybook/react-vite";

import { ContentError, ContentLoading } from "./ContentState";

const meta: Meta<typeof ContentLoading> = {
  title: "Site/ContentState",
  component: ContentLoading,
};

export default meta;

type Story = StoryObj<typeof ContentLoading>;

export const Loading: Story = {};

export const Error: StoryObj<typeof ContentError> = {
  render: () => <ContentError />,
};
