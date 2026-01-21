/**
 * Button Component - Adapter for HeroUI Button
 *
 * Maps legacy variants (DaisyUI naming) to HeroUI variants/colors.
 */
import { Button as HeroButton } from "@heroui/react";
import { type ComponentProps, forwardRef } from "react";

import { cn } from "@/lib/utils";

// HeroUI v3 Beta Button exports might be inferred as ButtonRoot which inherits ButtonVariants.
// We explicitly define our props to override/extend.
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
}

const mapVariantToHero = (
  variant: ButtonProps["variant"] = "primary",
): {
  variant?: "primary" | "secondary" | "tertiary" | "ghost" | "danger";
  className?: string;
} => {
  switch (variant) {
    case "danger":
    case "error":
      return { variant: "danger" };
    case "success":
      // Success variant missing in this version, override primary with success colors
      return {
        variant: "primary",
        className: "bg-success text-success-content hover:bg-success/90",
      };
    case "secondary":
      return { variant: "secondary" };
    case "ghost":
      return { variant: "ghost" };
    case "link":
      return { variant: "ghost", className: "underline underline-offset-4 text-primary" };
    case "outline":
      // Map outline to tertiary (often bordered/flat) or ghost with border
      return { variant: "ghost", className: "border border-base-content/20" };
    case "tertiary":
      return { variant: "tertiary" };
    default:
      return { variant: "primary" };
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
    const { variant: heroVariant, className: variantClassName } = mapVariantToHero(variant);

    return (
      <HeroButton
        ref={ref}
        className={cn(variantClassName, className)}
        variant={heroVariant}
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
