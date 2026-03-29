/**
 * Button Component - Adapter for HeroUI Button
 */

import { Button as HeroButton } from "@heroui/react";
import { type ComponentProps, type ElementType, type ReactNode, type Ref } from "react";

import { cn } from "@/lib/utils";

type HeroUIVariant = ComponentProps<typeof HeroButton>["variant"];

export interface ButtonProps extends Omit<
  ComponentProps<typeof HeroButton>,
  "variant" | "isLoading" | "size"
> {
  ref?: Ref<HTMLButtonElement>;
  variant?: HeroUIVariant;
  isLoading?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit" | "reset";
  title?: string;
  as?: ElementType;
  startContent?: ReactNode;
  endContent?: ReactNode;
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
}

function Button({
  ref,
  className,
  variant,
  size = "md",
  fullWidth,
  isLoading,
  isDisabled,
  children,
  startContent,
  endContent,
  as,
  ...props
}: ButtonProps) {
  const passthroughProps = (as ? { ...props, as } : props) as ComponentProps<typeof HeroButton>;

  const content =
    typeof children === "function" ? (
      children
    ) : (
      <>
        {startContent}
        {children as ReactNode}
        {endContent}
      </>
    );

  return (
    <HeroButton
      ref={ref}
      className={cn(className)}
      variant={variant}
      size={size}
      isDisabled={isDisabled ?? props.disabled}
      isPending={isLoading}
      fullWidth={fullWidth}
      {...passthroughProps}
    >
      {content}
    </HeroButton>
  );
}

Button.displayName = "Button";
export { Button };
