/**
 * Button Component - Adapter for HeroUI Button
 *
 * Type-safe wrapper that:
 * - Extracts variant types automatically from HeroUI (not manually maintained)
 * - Adds legacy/mapped variants (error, success, link)
 * - Makes variant prop strict: compile-time validation only
 */
import type { VariantProps } from "tailwind-variants";
// biome-ignore lint: buttonVariants is needed for VariantProps to extract types
import { Button as HeroButton, buttonVariants } from "@heroui/react";
import { type ComponentProps, forwardRef } from "react";

import { cn } from "@/lib/utils";

/** Automatically extract HeroUI Button variants from the design system */
type HeroUIVariant = VariantProps<typeof buttonVariants>["variant"];

/** Legacy or custom mapped variants */
type LegacyVariant = "error" | "success" | "link";

/** All valid variants: HeroUI + legacy/mapped (automatically kept in sync) */
type ValidButtonVariant = HeroUIVariant | LegacyVariant;

export interface ButtonProps
  extends Omit<ComponentProps<typeof HeroButton>, "variant" | "isLoading" | "size"> {
  /**
   * Button variant (automatically validated against HeroUI design system).
   * Valid HeroUI: danger | danger-soft | ghost | outline | primary | secondary | tertiary
   * Legacy mapped: error → danger | success → primary | link → ghost + underline
   */
  variant?: ValidButtonVariant;
  isLoading?: boolean;
  disabled?: boolean;
  title?: string;
  size?: "xs" | "sm" | "md" | "lg";
  as?: React.ElementType;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
  type?: "button" | "submit" | "reset";
}

const mapVariantToHero = (
  variant: ButtonProps["variant"],
): {
  variant: ComponentProps<typeof HeroButton>["variant"];
  className?: string;
} => {
  // No runtime validation needed - TypeScript ensures only valid variants reach here
  switch (variant) {
    case "error":
      return { variant: "danger" };
    case "success":
      return {
        variant: "primary",
        className: "bg-success text-success-foreground hover:bg-success/90",
      };
    case "link":
      return { variant: "ghost", className: "underline underline-offset-4 text-primary" };
    default:
      return { variant: variant as ComponentProps<typeof HeroButton>["variant"] };
  }
};

const mapSizeToHero = (size: string | undefined): "sm" | "md" | "lg" | undefined => {
  if (size === "xs") return "sm";
  return size as "sm" | "md" | "lg" | undefined;
};

const FinalButton = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size = "md", fullWidth, isLoading, isDisabled, children, ...props },
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
