import { Button as HeroButton } from "@heroui/react";
import React from "react";

import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "link" | "outline" | "error" | "success";
  size?: "sm" | "md" | "lg" | "xs";
  as?: React.ElementType;
  href?: string;
  isLoading?: boolean;
}

// Map legacy variants to HeroUI v3 variants
type HeroVariant = "primary" | "secondary" | "ghost" | "danger" | "tertiary";

const variantMap: Record<NonNullable<ButtonProps["variant"]>, HeroVariant> = {
  primary: "primary",
  secondary: "secondary",
  ghost: "ghost",
  link: "ghost",
  outline: "tertiary",
  error: "danger",
  success: "primary",
};

/**
 * Button component using HeroUI v3.
 * Maintains backward compatibility with existing prop API.
 */
export default function Button({
  variant = "primary",
  size = "md",
  className,
  as: _as, // Capture but don't use directly on HeroButton
  href,
  children,
  isLoading,
  disabled,
  type = "button",
  onClick,
  ...props
}: ButtonProps) {
  // Map size (HeroUI doesn't have xs, use sm)
  const heroSize = size === "xs" ? "sm" : size;
  const heroVariant = variantMap[variant];

  // Extra classes for specific variants
  const extraClasses = cn(
    variant === "link" && "underline underline-offset-4",
    variant === "success" && "bg-success text-success-content hover:bg-success/90",
    className
  );

  // For links, render as anchor with button styling
  if (href) {
    return (
      <a
        href={href}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
          "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          heroVariant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
          heroVariant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/90",
          heroVariant === "ghost" && "hover:bg-accent hover:text-accent-foreground",
          heroVariant === "tertiary" &&
            "border-input bg-background hover:bg-accent hover:text-accent-foreground border",
          heroVariant === "danger" && "bg-error text-error-foreground hover:bg-error/90",
          heroSize === "sm" && "h-8 px-3 text-sm",
          heroSize === "md" && "h-10 px-4 text-sm",
          heroSize === "lg" && "h-12 px-6 text-base",
          (disabled || isLoading) && "pointer-events-none opacity-50",
          extraClasses
        )}
        aria-disabled={disabled || isLoading}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {isLoading && <span className="loading loading-spinner loading-sm" />}
        {children}
      </a>
    );
  }

  // For regular buttons, use HeroUI Button
  return (
    <HeroButton
      variant={heroVariant}
      size={heroSize}
      isPending={isLoading}
      isDisabled={disabled || isLoading}
      type={type}
      onPress={onClick as unknown as () => void}
      className={extraClasses}
    >
      {children}
    </HeroButton>
  );
}
