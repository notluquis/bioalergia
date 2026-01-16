import React from "react";

import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "link" | "outline" | "error" | "success";
  size?: "sm" | "md" | "lg" | "xs";
  as?: React.ElementType;
  href?: string;
  isLoading?: boolean;
}

// Map legacy variants to Tailwind classes (keeping DaisyUI-compatible styling)
const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-base-content/10 bg-transparent",
  link: "text-primary underline-offset-4 hover:underline bg-transparent",
  outline: "border border-base-content/20 bg-transparent hover:bg-base-content/5",
  error: "bg-error text-error-content hover:bg-error/90",
  success: "bg-success text-success-content hover:bg-success/90",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  xs: "h-7 px-2 text-xs rounded-md",
  sm: "h-8 px-3 text-sm rounded-lg",
  md: "h-10 px-4 text-sm rounded-xl",
  lg: "h-12 px-6 text-base rounded-2xl",
};

/**
 * Button component - Native HTML button with consistent styling.
 * Reverted from HeroUI to avoid onPress/onClick incompatibility issues.
 */
export default function Button({
  variant = "primary",
  size = "md",
  className,
  as,
  href,
  children,
  isLoading,
  disabled,
  type = "button",
  onClick,
  ...props
}: ButtonProps) {
  const baseClasses = cn(
    "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98]",
    variantClasses[variant],
    sizeClasses[size],
    className
  );

  // Handle polymorphic rendering with href
  if (href) {
    const Component = as || "a";
    return (
      <Component
        href={href}
        className={cn(baseClasses, (disabled || isLoading) && "pointer-events-none opacity-50")}
        aria-disabled={disabled || isLoading}
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
    <Component type={type} className={baseClasses} disabled={disabled || isLoading} onClick={onClick} {...props}>
      {isLoading && <span className="loading loading-spinner loading-sm" />}
      {children}
    </Component>
  );
}
