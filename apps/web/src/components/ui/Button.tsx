/**
 * Button Component - Adapter for HeroUI Button
 *
 * Maps legacy variants (DaisyUI naming) to HeroUI variants/colors.
 */
import { Button as HeroButton } from "@heroui/react";
import { type ComponentProps, forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface ButtonProps
  extends Omit<
    ComponentProps<typeof HeroButton>,
    "variant" | "color" | "isLoading" | "isPending" | "size"
  > {
  // We maintain legacy variants for compatibility
  variant?:
    | "danger"
    | "error"
    | "ghost"
    | "link"
    | "outline"
    | "primary"
    | "secondary"
    | "success"
    | "tertiary";
  isLoading?: boolean;
  disabled?: boolean;
  title?: string;
  size?: "xs" | "sm" | "md" | "lg";
  as?: React.ElementType;
}

const mapVariantToHero = (
  variant: ButtonProps["variant"] = "primary",
): {
  variant?: ComponentProps<typeof HeroButton>["variant"];
  color?: ComponentProps<typeof HeroButton>["color"];
  className?: string;
} => {
  switch (variant) {
    case "danger":
    case "error":
      return { color: "danger", variant: "solid" };
    case "success":
      return { color: "success", variant: "solid" };
    case "secondary":
      return { color: "secondary", variant: "solid" };
    case "ghost":
      return { variant: "light" };
    case "link":
      return { variant: "light", color: "primary", className: "underline underline-offset-4" };
    case "outline":
      return { variant: "bordered", color: "default" }; // Default border color
    case "tertiary":
      return { variant: "flat" };
    default:
      return { color: "primary", variant: "solid" };
  }
};

const mapSizeToHero = (size: string | undefined): "sm" | "md" | "lg" | undefined => {
  if (size === "xs") return "sm";
  return size as "sm" | "md" | "lg" | undefined;
};

const FinalButton = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      fullWidth,
      isLoading,
      isDisabled,
      children,
      ...props
    },
    ref,
  ) => {
    const {
      variant: heroVariant,
      color: heroColor,
      className: variantClassName,
    } = mapVariantToHero(variant);

    return (
      <HeroButton
        ref={ref}
        className={cn(variantClassName, className)}
        variant={heroVariant}
        color={heroColor}
        size={mapSizeToHero(size)}
        isDisabled={isDisabled ?? props.disabled}
        isPending={isLoading}
        fullWidth={fullWidth}
        {...props}
      >
        {children}
      </HeroButton>
    );
  },
);

FinalButton.displayName = "Button";

export default FinalButton;
