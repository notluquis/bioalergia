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
  // We maintain legacy variants for compatibility, but also allow native HeroUI variants
  variant?:
    | ComponentProps<typeof HeroButton>["variant"]
    | "error" // Legacy: maps to danger
    | "success" // Legacy: maps to primary + success class
    | "link" // Legacy: maps to ghost + underline
    | "bordered" // HeroUI variant
    | (string & {}); // Allow any string for flexibility
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
  switch (variant) {
    case "error":
      return { variant: "danger" };
    case "success":
      // Legacy success mapping
      return {
        variant: "primary",
        className: "bg-success text-success-foreground hover:bg-success/90",
      };
    case "link":
      return { variant: "ghost", className: "underline underline-offset-4 text-primary" };
    // Explicit mappings for other legacy-but-same names are not strictly needed if we pass through,
    // but we keep them minimal.
    // If it's a native variant (e.g. "danger-soft"), it falls to default.
    default:
      // Pass through as native variant.
      // We cast because we know it must be a valid variant if it passed TS check (mostly),
      // or it will just be passed to HeroUI which might ignore it.
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
