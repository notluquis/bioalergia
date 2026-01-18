/**
 * Button Component - Native HTML with HeroUI-inspired styling
 *
 * Using native HTML button for full API compatibility (title, aria-label, onClick, etc.)
 * Styled to match HeroUI/DaisyUI design system.
 */
import type React from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  as?: React.ElementType;
  fullWidth?: boolean;
  href?: string;
  isLoading?: boolean;
  size?: "lg" | "md" | "sm" | "xs";
  variant?: "danger" | "error" | "ghost" | "link" | "outline" | "primary" | "secondary" | "success" | "tertiary";
}

// Map variants to Tailwind classes
const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  danger: "bg-error text-error-content hover:bg-error/90",
  error: "bg-error text-error-content hover:bg-error/90",
  ghost: "hover:bg-base-content/10 bg-transparent",
  link: "text-primary underline-offset-4 hover:underline bg-transparent",
  outline: "border border-base-content/20 bg-transparent hover:bg-base-content/5",
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  success: "bg-success text-success-content hover:bg-success/90",
  tertiary: "text-primary hover:bg-primary/10 bg-transparent",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  lg: "h-12 px-6 text-base rounded-2xl",
  md: "h-10 px-4 text-sm rounded-xl",
  sm: "h-8 px-3 text-sm rounded-lg",
  xs: "h-7 px-2 text-xs rounded-md",
};

/**
 * Button component - Native HTML button with consistent styling.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      as,
      children,
      className,
      disabled,
      fullWidth,
      href,
      isLoading,
      onClick,
      size = "md",
      type = "button",
      variant = "primary",
      ...props
    },
    ref
  ) => {
    const baseClasses = cn(
      "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "active:scale-[0.98]",
      variantClasses[variant],
      sizeClasses[size],
      fullWidth && "w-full",
      className
    );

    // Handle polymorphic rendering with href
    if (href) {
      const Component = as || "a";
      return (
        <Component
          aria-disabled={disabled || isLoading}
          className={cn(baseClasses, (disabled || isLoading) && "pointer-events-none opacity-50")}
          href={href}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {isLoading && <span className="loading loading-spinner loading-sm" />}
          {children}
        </Component>
      );
    }

    // For regular buttons, use native button
    const Component = as || "button";
    return (
      <Component
        className={baseClasses}
        disabled={disabled || isLoading}
        onClick={onClick}
        ref={ref}
        type={type}
        {...props}
      >
        {isLoading && <span className="loading loading-spinner loading-sm" />}
        {children}
      </Component>
    );
  }
);

Button.displayName = "Button";

export default Button;
