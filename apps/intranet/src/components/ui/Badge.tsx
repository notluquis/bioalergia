import { Chip, type ChipProps } from "@heroui/react";

export type BadgeProps = ChipProps;

export function Badge(props: Readonly<BadgeProps>) {
  return <Chip {...props} />;
}

export const badgeVariants = () => "";
