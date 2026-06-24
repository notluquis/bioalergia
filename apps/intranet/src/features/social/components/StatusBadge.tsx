import { Chip } from "@heroui/react";
import {
  SOCIAL_POST_STATUS_COLORS,
  SOCIAL_POST_STATUS_LABELS,
  SOCIAL_TARGET_STATUS_COLORS,
  SOCIAL_TARGET_STATUS_LABELS,
  type SocialPostStatus,
  type SocialTargetStatus,
} from "../types";

export function PostStatusBadge({ status }: Readonly<{ status: SocialPostStatus }>) {
  return (
    <Chip color={SOCIAL_POST_STATUS_COLORS[status]} size="sm" variant="soft">
      {SOCIAL_POST_STATUS_LABELS[status]}
    </Chip>
  );
}

export function TargetStatusBadge({ status }: Readonly<{ status: SocialTargetStatus }>) {
  return (
    <Chip color={SOCIAL_TARGET_STATUS_COLORS[status]} size="sm" variant="soft">
      {SOCIAL_TARGET_STATUS_LABELS[status]}
    </Chip>
  );
}
