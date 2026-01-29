/**
 * Button Component - Adapter for HeroUI Button
 *
 * Maps legacy variants (DaisyUI naming) to HeroUI variants/colors.
 */
import { Button as HeroButton } from "@heroui/react";
import { type ComponentProps, forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface ButtonProps
  extends Omit<ComponentProps<typeof HeroButton>, "variant" | "isLoading" | "size"> {
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
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
}

const mapVariantToHero = (
  variant: ButtonProps["variant"] = "primary",
): {
  variant: ComponentProps<typeof HeroButton>["variant"];
  className?: string;
} => {
  switch (variant) {
    case "danger":
    case "error":
      return { variant: "danger" };
    case "success":
      // HeroUI v3 beta doesn't have a direct 'success' variant for buttons in this way,
      // but we can use primary or a custom class if needed.
      // For now, mapping to primary as a fallback or adding a semantic class.
      return { variant: "primary", className: "bg-success text-success-foreground" };
    case "secondary":
      return { variant: "secondary" };
    case "ghost":
      return { variant: "ghost" };
    case "link":
      return { variant: "ghost", className: "underline underline-offset-4 text-primary" };
    case "outline":
      return { variant: "outline" };
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
