/**
 * Button Component - Adapter for HeroUI Button
 *
 * Maps legacy variants (DaisyUI naming) to HeroUI variants/colors.
 * Provides runtime validation to warn about potentially invalid variants.
 *
 * Valid HeroUI variants: solid | bordered | flat | faded | shadow | ghost
 * Legacy/mapped variants: error | success | link | damage | outline | primary | secondary
 */
import { Button as HeroButton } from "@heroui/react";
import { type ComponentProps, forwardRef } from "react";

import { cn } from "@/lib/utils";

/** Valid HeroUI Button variants (as per HeroUI v3.0.0-beta) */
const VALID_HEROUI_VARIANTS = [
  "solid",
  "bordered",
  "flat",
  "faded",
  "shadow",
  "ghost",
] as const;

/** Legacy or custom variants (mapped or passed through) */
const KNOWN_CUSTOM_VARIANTS = [
  "error", // Legacy: maps to danger
  "success", // Legacy: maps to primary
  "link", // Legacy: maps to ghost + underline
  "danger", // HeroUI native
  "outline", // Common pattern from other libs
  "primary", // Commonly used for color-based styling
  "secondary", // Commonly used for color-based styling
] as const;

/**
 * Check if a variant is recognized (known to work or be intentionally mapped).
 * Returns false for random/typo strings.
 */
function isKnownVariant(variant: string): boolean {
  return (
    VALID_HEROUI_VARIANTS.includes(variant as typeof VALID_HEROUI_VARIANTS[number]) ||
    KNOWN_CUSTOM_VARIANTS.includes(variant as typeof KNOWN_CUSTOM_VARIANTS[number])
  );
}

export interface ButtonProps
  extends Omit<ComponentProps<typeof HeroButton>, "variant" | "isLoading" | "size"> {
  /**
   * Button variant.
   * Valid HeroUI: solid | bordered | flat | faded | shadow | ghost
   * Mapped: error → danger, success → primary, link → ghost + underline
   */
  variant?: string;
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
  // Runtime validation - warn if unrecognized variant
  if (variant && typeof variant === "string" && !isKnownVariant(variant)) {
    console.warn(
      `[Button] Unknown variant: "${variant}". 
Known HeroUI variants: ${VALID_HEROUI_VARIANTS.join(", ")}.
Known custom/legacy variants: ${KNOWN_CUSTOM_VARIANTS.join(", ")}.
This may not render as expected.`,
    );
  }

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
    // Pass through for other variants (native HeroUI or known custom)
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
