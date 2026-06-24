import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  SOCIAL_POST_STATUS_LABELS,
  SOCIAL_TARGET_STATUS_LABELS,
  type SocialPostStatus,
  type SocialTargetStatus,
} from "../types";
import { PostStatusBadge, TargetStatusBadge } from "./StatusBadge";

// Visual catalog for the social approval-panel status chips. Renders every
// post-status and target-status variant so Chromatic captures the full color
// matrix (default/warning/accent/success/danger × light/dark).

const POST_STATUSES = Object.keys(SOCIAL_POST_STATUS_LABELS) as SocialPostStatus[];
const TARGET_STATUSES = Object.keys(SOCIAL_TARGET_STATUS_LABELS) as SocialTargetStatus[];

const meta: Meta<typeof PostStatusBadge> = {
  title: "Social/StatusBadge",
  component: PostStatusBadge,
  parameters: {
    docs: {
      description: {
        component:
          "Chips de estado para el panel de redes sociales: estado de la publicación (PostStatusBadge) y estado por destino/red (TargetStatusBadge). Colores semánticos vía tokens HeroUI v3.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PostStatusBadge>;

export const PostStatuses: Story = {
  name: "Estado de publicación — todos",
  render: () => (
    <div className="flex flex-wrap gap-2">
      {POST_STATUSES.map((status) => (
        <PostStatusBadge key={status} status={status} />
      ))}
    </div>
  ),
};

export const TargetStatuses: Story = {
  name: "Estado por destino — todos",
  render: () => (
    <div className="flex flex-wrap gap-2">
      {TARGET_STATUSES.map((status) => (
        <TargetStatusBadge key={status} status={status} />
      ))}
    </div>
  ),
};
